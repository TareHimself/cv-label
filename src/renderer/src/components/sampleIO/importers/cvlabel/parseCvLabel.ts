import { AnnotationType, INewAnnotation, INewSample, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import type { VirtualFile } from '../virtualFileSystem'
import { resolveImagePath } from '../writeToScratch'

export type CvLabelClass = {
  id: string
  name: string
}

type ManifestAnnotation = {
  id: string
  type: AnnotationType
  labelId: string
  points: { id: string; x: number; y: number }[]
}

type ManifestSample = {
  id: string
  name: string
  split: TrainingSplit
  annotations: ManifestAnnotation[]
  createdAt: string
  imageFile: string
}

type CvLabelManifest = {
  labels: CvLabelClass[]
  samples: ManifestSample[]
}

const isCvLabelManifest = (value: unknown): value is CvLabelManifest => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return Array.isArray(obj.labels) && Array.isArray(obj.samples)
}

const dirOf = (path: string) => {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx + 1)
}

/** Reads this app's own .cvlabel export - a manifest.json plus referenced images. `dir` is manifest.json's own folder, since `imageFile` paths are relative to it. Null if no valid manifest is found. */
export const findCvLabelManifest = async (
  files: VirtualFile[]
): Promise<{ manifest: CvLabelManifest; dir: string } | null> => {
  const manifestFile = files.find((f) => /(^|\/)manifest\.json$/i.test(f.path))
  if (!manifestFile) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(await manifestFile.text())
  } catch {
    return null
  }
  if (!isCvLabelManifest(parsed)) return null

  return { manifest: parsed, dir: dirOf(manifestFile.path) }
}

export type CvLabelPair = {
  sample: ManifestSample
  image: VirtualFile | null
}

/** Pairs each manifest sample with its referenced image file - a missing image is kept as null and skipped later, rather than failing the whole import. */
export const findCvLabelPairs = (
  manifest: CvLabelManifest,
  dir: string,
  files: VirtualFile[]
): CvLabelPair[] => {
  const byPath = new Map(files.map((f) => [f.path, f] as const))
  return manifest.samples.map((sample) => ({
    sample,
    image: byPath.get(`${dir}${sample.imageFile}`) ?? null
  }))
}

/** Converts the whole archive to samples, one image at a time (see yoloDatasetToSamples). Every id is regenerated fresh so re-importing never collides with existing records; annotations with no label mapping are dropped. */
export const cvLabelDatasetToSamples = async (
  pairs: CvLabelPair[],
  labelIdToProjectLabelId: Map<string, string | null>,
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  const samples: INewSample[] = []
  let processed = 0

  for (const pair of pairs) {
    if (pair.image) {
      const imagePath = await resolveImagePath(pair.image, scratchDir)

      const annotations: INewAnnotation[] = []
      for (const annotation of pair.sample.annotations) {
        const labelId = labelIdToProjectLabelId.get(annotation.labelId)
        if (labelId === undefined || labelId === null) continue
        annotations.push({
          id: makeUUID(),
          type: annotation.type,
          labelId,
          points: annotation.points.map((p) => ({ id: makeUUID(), x: p.x, y: p.y }))
        })
      }

      samples.push({
        id: makeUUID(),
        name: pair.sample.name,
        imagePath,
        split: pair.sample.split,
        annotations,
        createdAt: pair.sample.createdAt
      })
    }

    processed += 1
    onProgress?.(processed, pairs.length)
  }

  return samples
}
