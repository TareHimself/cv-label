import { AnnotationType, INewAnnotation, INewSample, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { fileToBase64 } from '@renderer/utils'
import type { VirtualFile } from '../virtualFileSystem'

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

/** Reads this app's own .cvlabel export - a manifest.json (a label list plus a flat
 *  sample list, no task grouping) alongside the referenced images. `dir` is the folder
 *  manifest.json itself lives in, since `imageFile` paths are relative to it (matters if
 *  a zip tool wrapped the export in an extra top-level folder). Returns null if no valid
 *  manifest is found, so the caller can show a clear "not a .cvlabel file" error. */
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

/** Pairs each manifest sample with its referenced image file. A sample whose image is
 *  missing from the archive is kept with a null image and skipped when building samples,
 *  rather than failing the whole import. */
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

/** Converts the whole archive to samples, one image at a time (not in parallel - see
 *  yoloDatasetToSamples for why). Every id (sample, annotation, point) is regenerated
 *  fresh rather than reusing the exported ones, so re-importing the same file twice - or
 *  into the project it came from - never collides with existing records. Each
 *  annotation's `labelId` is remapped via `labelIdToProjectLabelId`; annotations whose
 *  source label has no mapping are dropped. */
export const cvLabelDatasetToSamples = async (
  pairs: CvLabelPair[],
  labelIdToProjectLabelId: Map<string, string>,
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  const samples: INewSample[] = []
  let processed = 0

  for (const pair of pairs) {
    if (pair.image) {
      const blob = await pair.image.blob()
      const base64Image = await fileToBase64(blob)

      const annotations: INewAnnotation[] = []
      for (const annotation of pair.sample.annotations) {
        const labelId = labelIdToProjectLabelId.get(annotation.labelId)
        if (labelId === undefined) continue
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
        base64Image,
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
