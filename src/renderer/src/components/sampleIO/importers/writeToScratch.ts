import { makeUUID } from '@shared/utils'
import type { VirtualFile } from './virtualFileSystem'

export const extensionOf = (path: string) => {
  const idx = path.lastIndexOf('.')
  return idx === -1 ? 'bin' : path.slice(idx + 1).toLowerCase()
}

/** Writes one blob to a fresh file under scratchDir - only one image at a time crosses into a scratch file, never held as base64/blob for the whole batch. */
export const writeBlobToScratchFile = async (
  scratchDir: string,
  blob: Blob,
  extension: string
): Promise<string> => {
  const filePath = `${scratchDir}/${makeUUID()}.${extension}`
  await window.system.writeFile(filePath, await blob.arrayBuffer())
  return filePath
}

/** A disk-backed VirtualFile is reused as-is; a blob-backed one is written to scratchDir. */
export const resolveImagePath = async (image: VirtualFile, scratchDir: string): Promise<string> => {
  if (image.diskPath) return image.diskPath
  const blob = await image.blob()
  return writeBlobToScratchFile(scratchDir, blob, extensionOf(image.path))
}
