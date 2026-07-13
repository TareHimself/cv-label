import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { virtualFilesFromFileList, virtualFilesFromZip } from '../virtualFileSystem'

const makeFileList = (files: File[]): FileList => {
  const list: Record<number, File> & { length: number; item: (i: number) => File | null } = {
    length: files.length,
    item: (i: number) => files[i] ?? null
  }
  files.forEach((file, i) => {
    list[i] = file
  })
  return list as unknown as FileList
}

describe('virtualFilesFromZip', () => {
  it('lists every file entry with its zip-relative path, and can read it back as text', async () => {
    const zip = new JSZip()
    zip.file('dataset/img1.jpg', 'fake-image-bytes')
    zip.file('dataset/labels/img1.txt', '0 0.5 0.5 0.1 0.1')
    const zipFile = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')

    const files = await virtualFilesFromZip(zipFile)

    expect(files.map((f) => f.path).sort()).toEqual(['dataset/img1.jpg', 'dataset/labels/img1.txt'])
    const label = files.find((f) => f.path === 'dataset/labels/img1.txt')
    expect(await label?.text()).toBe('0 0.5 0.5 0.1 0.1')
  })

  it('excludes directory entries', async () => {
    const zip = new JSZip()
    zip.file('dataset/img1.jpg', 'x')

    const files = await virtualFilesFromZip(
      new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')
    )

    expect(files.map((f) => f.path)).not.toContain('dataset/')
    expect(files).toHaveLength(1)
  })

  it('normalizes backslashes to forward slashes in entry paths', async () => {
    const zip = new JSZip()
    zip.file('dataset\\img1.jpg', 'x')

    const [file] = await virtualFilesFromZip(
      new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')
    )

    expect(file.path).toBe('dataset/img1.jpg')
  })

  it('exposes each entry as a Blob via blob()', async () => {
    const zip = new JSZip()
    zip.file('img1.jpg', 'fake-image-bytes')

    const [file] = await virtualFilesFromZip(
      new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')
    )
    const blob = await file.blob()

    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe('fake-image-bytes')
  })
})

describe('virtualFilesFromFileList', () => {
  it('uses webkitRelativePath when present (folder picker)', () => {
    const file = new File(['x'], 'img1.jpg')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'dataset/images/img1.jpg' })

    const [virtualFile] = virtualFilesFromFileList(makeFileList([file]))

    expect(virtualFile.path).toBe('dataset/images/img1.jpg')
  })

  it('falls back to the bare file name when webkitRelativePath is empty (single-file picker)', () => {
    const file = new File(['x'], 'img1.jpg')

    const [virtualFile] = virtualFilesFromFileList(makeFileList([file]))

    expect(virtualFile.path).toBe('img1.jpg')
  })

  it('normalizes backslashes to forward slashes', () => {
    const file = new File(['x'], 'img1.jpg')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'dataset\\images\\img1.jpg' })

    const [virtualFile] = virtualFilesFromFileList(makeFileList([file]))

    expect(virtualFile.path).toBe('dataset/images/img1.jpg')
  })

  it('reads text() and blob() from the underlying File', async () => {
    const file = new File(['fake-image-bytes'], 'img1.jpg')

    const [virtualFile] = virtualFilesFromFileList(makeFileList([file]))

    expect(await virtualFile.text()).toBe('fake-image-bytes')
    expect(await virtualFile.blob()).toBe(file)
  })
})
