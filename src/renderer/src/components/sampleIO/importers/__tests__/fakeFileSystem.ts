import { vi } from 'vitest'
import JSZip from 'jszip'

/** An in-memory stand-in for window.system/window.zip/window.fileUtils's disk
 *  operations, so tests can exercise the real virtualFilesFromExtractedZip/scratch-write
 *  code paths without a real filesystem. Returns the backing maps for assertions. */
export const installFakeFileSystem = () => {
  const files = new Map<string, ArrayBuffer>()
  // getPathForFile is synchronous and never reads the file, matching webUtils - the
  // actual bytes are only read lazily, inside extractTo, once a path is looked up there.
  const pickedFiles = new Map<string, File>()
  let nextPickedId = 0

  const createTemporaryDirectory = vi.fn().mockResolvedValue('/scratch')
  const writeFile = vi.fn((path: string, data: ArrayBuffer) => {
    files.set(path, data)
    return Promise.resolve()
  })
  const deleteFile = vi.fn((path: string) => {
    files.delete(path)
    return Promise.resolve()
  })
  const readTextFile = vi.fn((path: string) => {
    const data = files.get(path)
    return Promise.resolve(data ? new TextDecoder().decode(data) : '')
  })
  const listFilesRecursive = vi.fn((dir: string) => {
    const prefix = `${dir}/`
    return Promise.resolve(
      Array.from(files.keys())
        .filter((p) => p.startsWith(prefix))
        .map((p) => p.slice(prefix.length))
    )
  })
  const getFileSize = vi.fn((path: string) => Promise.resolve(files.get(path)?.byteLength ?? 0))
  const getPathForFile = vi.fn((file: File) => {
    const path = `/picked/${nextPickedId++}-${file.name}`
    pickedFiles.set(path, file)
    return path
  })
  const extractTo = vi.fn(async (zipPath: string, destDir: string) => {
    const pickedFile = pickedFiles.get(zipPath)
    const data = pickedFile ? await pickedFile.arrayBuffer() : files.get(zipPath)
    if (!data) return
    const zip = await JSZip.loadAsync(data)
    await Promise.all(
      Object.entries(zip.files).map(async ([relativePath, entry]) => {
        if (entry.dir) return
        files.set(`${destDir}/${relativePath}`, await entry.async('arraybuffer'))
      })
    )
  })

  window.system = {
    createTemporaryDirectory,
    writeFile,
    deleteFile,
    readTextFile,
    listFilesRecursive,
    getFileSize
  } as unknown as typeof window.system
  window.zip = { extractTo } as unknown as typeof window.zip
  window.fileUtils = { getPathForFile } as unknown as typeof window.fileUtils

  return {
    files,
    pickedFiles,
    createTemporaryDirectory,
    writeFile,
    deleteFile,
    readTextFile,
    listFilesRecursive,
    getFileSize,
    getPathForFile,
    extractTo
  }
}
