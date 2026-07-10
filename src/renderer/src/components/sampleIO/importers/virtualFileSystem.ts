import JSZip from 'jszip'

/** A file from either a zip archive or a picked folder, addressed by a forward-slash
 *  relative path so the rest of the importers don't need to know which source it
 *  came from. */
export type VirtualFile = {
  path: string
  text: () => Promise<string>
  blob: () => Promise<Blob>
}

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

export const virtualFilesFromFileList = (fileList: FileList): VirtualFile[] => {
  // webkitdirectory-selected files carry their folder-relative path here, e.g.
  // "MyDataset/images/train/img1.jpg".
  return Array.from(fileList).map((file) => ({
    path: (file.webkitRelativePath || file.name).replace(/\\/g, '/'),
    text: () => file.text(),
    blob: () => Promise.resolve(file)
  }))
}
