import { makeUUID } from '@shared/utils'
import type { VirtualFile } from './virtualFileSystem'

export const extensionOf = (path: string) => {
  const idx = path.lastIndexOf('.')
  return idx === -1 ? 'bin' : path.slice(idx + 1).toLowerCase()
}

/** Writes one blob to a fresh file under scratchDir, returning its path. Images ingested
 *  this way never get held as base64/blob arrays for the whole import batch - only one at
 *  a time crosses into a scratch file, which the store then consumes directly by path. */
export const writeBlobToScratchFile = async (
  scratchDir: string,
  blob: Blob,
  extension: string
): Promise<string> => {
  const filePath = `${scratchDir}/${makeUUID()}.${extension}`
  await window.system.writeFile(filePath, await blob.arrayBuffer())
  return filePath
}

/** A disk-backed VirtualFile (extracted from a zip) is reused as-is - no extra copy. A
 *  blob-backed one (from a picked folder) has no on-disk file yet, so it's written to
 *  scratchDir. */
export const resolveImagePath = async (image: VirtualFile, scratchDir: string): Promise<string> => {
  if (image.diskPath) return image.diskPath
  const blob = await image.blob()
  return writeBlobToScratchFile(scratchDir, blob, extensionOf(image.path))
}
