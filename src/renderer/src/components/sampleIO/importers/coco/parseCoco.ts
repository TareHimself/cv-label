import { AnnotationType, INewAnnotation, INewSample, IPoint, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { normalizeFilename } from '@renderer/utils'
import { splitFromPath } from '../splitFromPath'
import type { VirtualFile } from '../virtualFileSystem'
import { resolveImagePath } from '../writeToScratch'

type RawCocoImage = {
  id: number
  file_name: string
  width?: number
  height?: number
}

type RawCocoAnnotation = {
  image_id: number
  category_id: number
  bbox: [number, number, number, number]
  segmentation?: number[][]
}

type RawCocoCategory = {
  id: number
  name: string
}

type RawCocoDataset = {
  images: RawCocoImage[]
  annotations: RawCocoAnnotation[]
  categories: RawCocoCategory[]
}

const isRawCocoDataset = (value: unknown): value is RawCocoDataset => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    Array.isArray(obj.images) && Array.isArray(obj.annotations) && Array.isArray(obj.categories)
  )
}

const dirOf = (path: string) => {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx + 1)
}

const basenameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** Parses every `*.json` file with `images`/`annotations`/`categories` arrays - covers this app's own export and hand-rolled COCO datasets alike. Invalid/mismatched files are skipped, not fatal. */
const parseCocoJsonFiles = async (
  files: VirtualFile[]
): Promise<{ dir: string; dataset: RawCocoDataset }[]> => {
  const results: { dir: string; dataset: RawCocoDataset }[] = []

  for (const file of files.filter((f) => /\.json$/i.test(f.path))) {
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      continue
    }
    if (isRawCocoDataset(parsed)) {
      results.push({ dir: dirOf(file.path), dataset: parsed })
    }
  }

  return results
}

export type CocoClass = {
  id: number
  name: string
}

/** Every category referenced across all found COCO files, deduplicated by id (first wins), in encounter order. */
export const findCocoClasses = async (files: VirtualFile[]): Promise<CocoClass[]> => {
  const classes = new Map<number, string>()
  for (const { dataset } of await parseCocoJsonFiles(files)) {
    for (const category of dataset.categories) {
      if (!classes.has(category.id)) classes.set(category.id, category.name)
    }
  }
  return Array.from(classes, ([id, name]) => ({ id, name }))
}

export type CocoImagePair = {
  image: VirtualFile
  annotations: RawCocoAnnotation[]
  split: TrainingSplit
}

/** Pairs each image with its annotations - `file_name` resolves relative to the annotations file's own directory (Roboflow/COCO convention). Split is inferred from the path, same as the YOLO importer. */
export const findCocoImagePairs = async (files: VirtualFile[]): Promise<CocoImagePair[]> => {
  const byPath = new Map(files.map((f) => [f.path, f] as const))
  const pairs: CocoImagePair[] = []

  for (const { dir, dataset } of await parseCocoJsonFiles(files)) {
    const annotationsByImageId = new Map<number, RawCocoAnnotation[]>()
    for (const annotation of dataset.annotations) {
      const bucket = annotationsByImageId.get(annotation.image_id) ?? []
      bucket.push(annotation)
      annotationsByImageId.set(annotation.image_id, bucket)
    }

    for (const cocoImage of dataset.images) {
      const image = byPath.get(`${dir}${cocoImage.file_name}`)
      if (!image) continue

      pairs.push({
        image,
        annotations: annotationsByImageId.get(cocoImage.id) ?? [],
        split: splitFromPath(image.path)
      })
    }
  }

  return pairs
}

const isBboxRectangle = (
  segmentation: number[],
  bbox: [number, number, number, number]
): boolean => {
  if (segmentation.length !== 8) return false
  const [x, y, w, h] = bbox
  const expected = [x, y, x + w, y, x + w, y + h, x, y + h]
  return expected.every((v, i) => Math.abs(v - segmentation[i]) < 1e-6)
}

/** A `segmentation` that isn't just the bbox's own rectangle (real shape data, unlike what this app's own exporter writes for boxes) becomes a Polygon; everything else becomes a Box from `bbox`. */
export const cocoAnnotationToPoints = (
  annotation: RawCocoAnnotation
): { type: AnnotationType; points: IPoint[] } => {
  const polygon = annotation.segmentation?.[0]
  if (polygon && polygon.length >= 6 && !isBboxRectangle(polygon, annotation.bbox)) {
    const points: IPoint[] = []
    for (let i = 0; i + 1 < polygon.length; i += 2) {
      points.push({ id: makeUUID(), x: polygon[i], y: polygon[i + 1] })
    }
    return { type: AnnotationType.Polygon, points }
  }

  const [x, y, w, h] = annotation.bbox
  return {
    type: AnnotationType.Box,
    points: [
      { id: makeUUID(), x, y },
      { id: makeUUID(), x: x + w, y: y + h }
    ]
  }
}

const buildSampleFromCocoPair = async (
  pair: CocoImagePair,
  categoryIdToLabelId: Map<number, string | null>,
  scratchDir: string
): Promise<INewSample> => {
  const imagePath = await resolveImagePath(pair.image, scratchDir)

  const annotations: INewAnnotation[] = []
  for (const raw of pair.annotations) {
    const labelId = categoryIdToLabelId.get(raw.category_id)
    if (labelId === undefined || labelId === null) continue
    const { type, points } = cocoAnnotationToPoints(raw)
    annotations.push({ id: makeUUID(), type, labelId, points })
  }

  return {
    id: makeUUID(),
    name: normalizeFilename(basenameOf(pair.image.path)),
    imagePath,
    split: pair.split,
    annotations,
    createdAt: new Date().toISOString()
  }
}

/** Converts the whole dataset to samples, one image at a time (see yoloDatasetToSamples). */
export const cocoDatasetToSamples = async (
  pairs: CocoImagePair[],
  categoryIdToLabelId: Map<number, string | null>,
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  const samples: INewSample[] = []
  for (const pair of pairs) {
    samples.push(await buildSampleFromCocoPair(pair, categoryIdToLabelId, scratchDir))
    onProgress?.(samples.length, pairs.length)
  }
  return samples
}
