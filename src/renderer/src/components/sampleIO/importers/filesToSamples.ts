import { INewSample, TrainingSplit } from '@shared/types'
import { fileToBase64, normalizeFilename } from '@renderer/utils'
import { makeUUID } from '@shared/utils'

export const filesToSamples = async (
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  let completed = 0
  const base64Data = await Promise.all(
    files.map(async (c) => {
      const data = await fileToBase64(c)
      completed += 1
      onProgress?.(completed, files.length)
      return data
    })
  )
  return files.map<INewSample>((c, idx) => ({
    id: makeUUID(),
    name: normalizeFilename(c.name),
    base64Image: base64Data[idx],
    split: TrainingSplit.Train,
    annotations: [],
    createdAt: new Date().toISOString()
  }))
}
