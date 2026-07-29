import { INewSample, TrainingSplit } from '@shared/types'
import { normalizeFilename } from '@renderer/utils'
import { makeUUID } from '@shared/utils'
import { writeBlobToScratchFile } from './writeToScratch'

const extensionOf = (filename: string) => {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? 'bin' : filename.slice(idx + 1).toLowerCase()
}

/** Writes each file to scratchDir one at a time (not in parallel - datasets can run into
 *  the thousands of images, and holding them all as blobs/base64 at once risks spiking
 *  memory). Returns samples referencing the scratch paths, not image bytes. */
export const filesToSamples = async (
  files: File[],
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  const samples: INewSample[] = []

  for (const file of files) {
    const imagePath = await writeBlobToScratchFile(scratchDir, file, extensionOf(file.name))
    samples.push({
      id: makeUUID(),
      name: normalizeFilename(file.name),
      imagePath,
      split: TrainingSplit.Train,
      annotations: [],
      createdAt: new Date().toISOString()
    })
    onProgress?.(samples.length, files.length)
  }

  return samples
}
