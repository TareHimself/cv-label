import { describe, expect, it, beforeEach } from 'vitest'
import JSZip from 'jszip'
import {
  virtualFilesFromExtractedZip,
  virtualFilesFromFileList,
  virtualFilesFromZip
} from '../virtualFileSystem'
import { installFakeFileSystem } from './fakeFileSystem'

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

describe('virtualFilesFromExtractedZip', () => {
  beforeEach(() => {
    installFakeFileSystem()
  })

  it('extracts every entry to disk and sets diskPath, readable via text()', async () => {
    const zip = new JSZip()
    zip.file('dataset/img1.jpg', 'fake-image-bytes')
    zip.file('dataset/labels/img1.txt', '0 0.5 0.5 0.1 0.1')
    const zipFile = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')

    const files = await virtualFilesFromExtractedZip(zipFile, '/scratch')

    expect(files.map((f) => f.path).sort()).toEqual(['dataset/img1.jpg', 'dataset/labels/img1.txt'])
    const label = files.find((f) => f.path === 'dataset/labels/img1.txt')
    expect(label?.diskPath).toBe('/scratch/dataset/labels/img1.txt')
    expect(await label?.text()).toBe('0 0.5 0.5 0.1 0.1')
  })

  it('resolves the picked file via getPathForFile instead of copying its bytes through IPC', async () => {
    const zip = new JSZip()
    zip.file('img1.jpg', 'x')
    const zipFile = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')

    const { getPathForFile, extractTo, writeFile, deleteFile } = installFakeFileSystem()
    await virtualFilesFromExtractedZip(zipFile, '/scratch')

    expect(getPathForFile).toHaveBeenCalledWith(zipFile)
    expect(extractTo).toHaveBeenCalledWith(getPathForFile.mock.results[0].value, '/scratch')
    // No arrayBuffer()-and-ship-across-IPC copy of the picked file's own bytes - the file
    // it points at is already on disk, so there's nothing to write out or clean up here.
    expect(writeFile).not.toHaveBeenCalled()
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('falls back to writing the file bytes to scratch when it has no real path (e.g. a drag-and-drop-reconstructed File)', async () => {
    const { writeFile, deleteFile } = installFakeFileSystem()
    window.fileUtils.getPathForFile = () => ''
    const zip = new JSZip()
    zip.file('img1.jpg', 'x')
    const zipFile = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')

    const files = await virtualFilesFromExtractedZip(zipFile, '/scratch')

    expect(files.map((f) => f.path)).toEqual(['img1.jpg'])
    // The staged copy of the zip itself was written into scratchDir and then removed
    // before listing, so it isn't returned alongside the zip's own extracted entries.
    expect(writeFile).toHaveBeenCalledTimes(1)
    const [stagedPath] = writeFile.mock.calls[0]
    expect(stagedPath.startsWith('/scratch/')).toBe(true)
    expect(deleteFile).toHaveBeenCalledWith(stagedPath)
  })

  it('rejects blob() for a disk-backed entry rather than silently misreading it', async () => {
    const zip = new JSZip()
    zip.file('img1.jpg', 'x')
    const zipFile = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'dataset.zip')

    const [file] = await virtualFilesFromExtractedZip(zipFile, '/scratch')

    await expect(file.blob()).rejects.toThrow()
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
