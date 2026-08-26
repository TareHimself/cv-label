export const fileToBase64 = async (file: Blob) => {
  // use a FileReader to generate a base64 data URI:
  const buffer = await file.arrayBuffer()
  const base64url = await new Promise<string>((r) => {
    const reader = new FileReader()
    reader.onload = () => r(reader.result as string)
    reader.readAsDataURL(new Blob([buffer]))
  })
  // remove the `data:...;base64,` part from the start
  return base64url.slice(base64url.indexOf(',') + 1)
}

export const normalizeFilename = (filename: string) => {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) {
    return filename
  }

  return filename.slice(0, idx)
}

// A flat (non-folder) file's relativePath falls back to "./name.ext" (file-selector's
// own convention for "no real path") - strip that leading "./" first so it doesn't get
// mistaken for a real (if oddly named) folder segment.
const topFolderSegment = (path?: string): string | null => {
  const segments = path?.replace(/^\.\//, '').split('/').filter(Boolean) ?? []
  return segments.length >= 2 ? segments[0] : null
}

/** The dropped folder's name if every file's relativePath shares a common first segment - null for a flat drop or one spanning multiple folders. */
export const folderNameFromDroppedFiles = (files: { relativePath?: string }[]): string | null => {
  const folderName = topFolderSegment(files[0]?.relativePath)
  if (!folderName) return null

  const allMatch = files.every((f) => topFolderSegment(f.relativePath) === folderName)
  return allMatch ? folderName : null
}

/** Groups dropped files by their top-level folder, for offering a separate task per folder. A file with no folder segment is omitted. */
export const groupFilesByTopFolder = <T extends { relativePath?: string }>(
  files: T[]
): Map<string, T[]> => {
  const groups = new Map<string, T[]>()
  for (const file of files) {
    const folderName = topFolderSegment(file.relativePath)
    if (!folderName) continue
    const bucket = groups.get(folderName) ?? []
    bucket.push(file)
    groups.set(folderName, bucket)
  }
  return groups
}
