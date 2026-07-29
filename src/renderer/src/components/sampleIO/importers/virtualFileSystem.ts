import JSZip from 'jszip'

/** A file from either a zip archive or a picked folder, addressed by a forward-slash
 *  relative path so the rest of the importers don't need to know which source it
 *  came from. `diskPath` is set for disk-backed sources (a zip extracted to a scratch
 *  directory) - importers reuse it directly as a sample's imagePath instead of writing
 *  another scratch copy, and can look up its dimensions without ever reading its bytes
 *  into the renderer. */
export type VirtualFile = {
  path: string
  diskPath?: string
  text: () => Promise<string>
  blob: () => Promise<Blob>
}

/** Reads the whole input zip into memory - only used for small manifest/label reads via
 *  findYoloClasses etc. Large zip-based imports should extract to disk instead; see
 *  virtualFilesFromExtractedZip. */
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

/** Extracts a dropped zip disk-to-disk into scratchDir (via the main-process streaming
 *  extractor) instead of inflating the whole archive into renderer memory. Every entry's
 *  `diskPath` points at its real extracted location, so importers can reuse it as a
 *  sample's imagePath with no further copying.
 *
 *  Resolves the picked file's own real path via webUtils.getPathForFile rather than
 *  copying it into scratchDir first - a naive copy (read the File's bytes, ship them
 *  across IPC, write them back out) would hold the entire file in memory twice over for
 *  something that's already sitting on disk, which for a multi-gigabyte dataset export
 *  defeats the point of extracting it in a streaming fashion at all. */
export const virtualFilesFromExtractedZip = async (
  zipFile: File,
  scratchDir: string
): Promise<VirtualFile[]> => {
  const zipPath = window.fileUtils.getPathForFile(zipFile)
  if (!zipPath) {
    throw new Error('Could not resolve a real path for the selected file')
  }

  await window.zip.extractTo(zipPath, scratchDir)

  const relativePaths = await window.system.listFilesRecursive(scratchDir)

  return relativePaths.map((relativePath) => {
    const diskPath = `${scratchDir}/${relativePath}`
    return {
      path: relativePath,
      diskPath,
      text: () => window.system.readTextFile(diskPath),
      // Callers should use diskPath directly (as an imagePath, or via
      // window.system.getImageDimensions) instead of reading bytes back into the
      // renderer - blob() is only meaningful for in-memory sources.
      blob: () => Promise.reject(new Error('blob() is not supported for disk-backed files'))
    }
  })
}

/** Accepts a plain File[] as well as a live FileList - callers reading from an
 *  <input type="file"> should pass Array.from(input.files) captured synchronously in
 *  the change handler, before any await. input.files is the same mutable FileList object
 *  on every read (not a fresh snapshot), and gets cleared in place by a later
 *  `input.value = ''` reset - holding onto the FileList itself across an async gap silently
 *  empties it out from under you. */
export const virtualFilesFromFileList = (fileList: FileList | File[]): VirtualFile[] => {
  // webkitdirectory-selected files carry their folder-relative path here, e.g.
  // "MyDataset/images/train/img1.jpg".
  return Array.from(fileList).map((file) => ({
    path: (file.webkitRelativePath || file.name).replace(/\\/g, '/'),
    text: () => file.text(),
    blob: () => Promise.resolve(file)
  }))
}
