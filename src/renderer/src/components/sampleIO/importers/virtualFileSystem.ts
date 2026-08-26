import JSZip from 'jszip'
import { writeBlobToScratchFile } from './writeToScratch'

/** A file from a zip or picked folder, addressed by a relative path so importers don't need to know the source. `diskPath` is set for disk-backed sources, reusable directly as a sample's imagePath. */
export type VirtualFile = {
  path: string
  diskPath?: string
  text: () => Promise<string>
  blob: () => Promise<Blob>
}

/** Reads the whole zip into memory - only for small manifest/label reads. Large imports should use virtualFilesFromExtractedZip instead. */
export const virtualFilesFromZip = async (zipFile: File): Promise<VirtualFile[]> => {
  const zip = await JSZip.loadAsync(zipFile)
  const files: VirtualFile[] = []

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return
    files.push({
      path: relativePath.replace(/\\/g, '/'),
      text: () => entry.async('text'),
      blob: () => entry.async('blob')
    })
  })

  return files
}

/** Extracts a dropped zip disk-to-disk into scratchDir instead of inflating it into renderer memory - falls back to a naive byte-copy only when the picked File has no resolvable real path (a Dropzone folder-drop re-materializes it via FileSystemEntry first, which Electron can't map back to a path). */
export const virtualFilesFromExtractedZip = async (
  zipFile: File,
  scratchDir: string
): Promise<VirtualFile[]> => {
  const resolvedPath = window.fileUtils.getPathForFile(zipFile)
  const zipPath = resolvedPath || (await writeBlobToScratchFile(scratchDir, zipFile, 'zip'))

  await window.zip.extractTo(zipPath, scratchDir)
  if (!resolvedPath) {
    // The staged copy lives inside scratchDir itself - remove it before listing so it isn't mistaken for an extracted entry.
    await window.system.deleteFile(zipPath)
  }

  const relativePaths = await window.system.listFilesRecursive(scratchDir)

  return relativePaths.map((relativePath) => {
    const diskPath = `${scratchDir}/${relativePath}`
    return {
      path: relativePath,
      diskPath,
      text: () => window.system.readTextFile(diskPath),
      // Callers should use diskPath directly instead - blob() is only for in-memory sources.
      blob: () => Promise.reject(new Error('blob() is not supported for disk-backed files'))
    }
  })
}

/** Accepts a plain File[] as well as a live FileList - capture via Array.from(input.files) synchronously in the change handler, since the live FileList empties out from under an async gap after `input.value = ''`. */
export const virtualFilesFromFileList = (fileList: FileList | File[]): VirtualFile[] => {
  // webkitdirectory-selected files carry a folder-relative path, e.g. "MyDataset/images/train/img1.jpg".
  return Array.from(fileList).map((file) => ({
    path: (file.webkitRelativePath || file.name).replace(/\\/g, '/'),
    text: () => file.text(),
    blob: () => Promise.resolve(file)
  }))
}
