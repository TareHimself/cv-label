import { parse as parseYaml } from 'yaml'
import { AnnotationType, INewAnnotation, INewSample, IPoint, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { normalizeFilename } from '@renderer/utils'
import { splitFromPath } from '../splitFromPath'
import type { VirtualFile } from '../virtualFileSystem'
import { writeBlobToScratchFile } from '../writeToScratch'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'bmp', 'webp'])

const extensionOf = (path: string) => {
  const idx = path.lastIndexOf('.')
  return idx === -1 ? '' : path.slice(idx + 1).toLowerCase()
}

const basenameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

const withoutExtension = (path: string) => {
  const idx = path.lastIndexOf('.')
  return idx === -1 ? path : path.slice(0, idx)
}

export type YoloClass = {
  id: number
  name: string
}

/** Reads class names from data.yaml/dataset.yaml (Ultralytics format, `names` as either a
 *  list or an `{id: name}` map) or classes.txt (one name per line, in order). Returns null
 *  if neither is present, so the caller can fall back to naming classes by their raw id. */
export const findYoloClasses = async (files: VirtualFile[]): Promise<YoloClass[] | null> => {
  const dataYaml = files.find((f) => /(^|\/)(data|dataset)\.ya?ml$/i.test(f.path))
  if (dataYaml) {
    const parsed = parseYaml(await dataYaml.text()) as { names?: unknown } | null
    const names = parsed?.names
    if (Array.isArray(names)) {
      return names.map((name, id) => ({ id, name: String(name) }))
    }
    if (names && typeof names === 'object') {
      return Object.entries(names as Record<string, unknown>)
        .map(([id, name]) => ({ id: Number(id), name: String(name) }))
        .sort((a, b) => a.id - b.id)
    }
  }

  const classesTxt = files.find((f) => /(^|\/)classes\.txt$/i.test(f.path))
  if (classesTxt) {
    const lines = (await classesTxt.text())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    return lines.map((name, id) => ({ id, name }))
  }

  return null
}

export type YoloBox = {
  classId: number
  /** Normalized [0,1] center/size, exactly as read from the label file. */
  cx: number
  cy: number
  w: number
  h: number
}

/** Parses a YOLO label .txt file's bounding-box lines (`class cx cy w h`). Ignores blank
 *  lines and any trailing columns (e.g. from segmentation/OBB variants) - only the first
 *  five fields are used. Malformed lines are skipped rather than failing the whole import. */
export const parseYoloLabelFile = (content: string): YoloBox[] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [classId, cx, cy, w, h] = line.split(/\s+/).map(Number)
      return { classId, cx, cy, w, h }
    })
    .filter(
      (box) =>
        Number.isFinite(box.classId) &&
        Number.isFinite(box.cx) &&
        Number.isFinite(box.cy) &&
        Number.isFinite(box.w) &&
        Number.isFinite(box.h)
    )
}

/** Converts a normalized YOLO box into the labeler's 2-point (top-left, bottom-right)
 *  absolute-pixel box representation. */
export const yoloBoxToPoints = (
  box: YoloBox,
  imageWidth: number,
  imageHeight: number
): [IPoint, IPoint] => [
  {
    id: makeUUID(),
    x: (box.cx - box.w / 2) * imageWidth,
    y: (box.cy - box.h / 2) * imageHeight
  },
  {
    id: makeUUID(),
    x: (box.cx + box.w / 2) * imageWidth,
    y: (box.cy + box.h / 2) * imageHeight
  }
]

export enum YoloLabelFormat {
  Detection = 'detection',
  Segmentation = 'segmentation'
}

export type YoloPolygon = {
  classId: number
  /** Normalized [0,1] polygon vertices, exactly as read from the label file. */
  points: { x: number; y: number }[]
}

/** Parses a YOLO-seg label .txt file's polygon lines (`class x1 y1 x2 y2 ... xn yn`).
 *  Requires at least 3 vertices - anything shorter isn't a real polygon and would be
 *  indistinguishable from a detection line anyway. Malformed or too-short lines are
 *  skipped rather than failing the whole import. */
export const parseYoloSegmentationLabelFile = (content: string): YoloPolygon[] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [classId, ...coords] = line.split(/\s+/).map(Number)
      const points: { x: number; y: number }[] = []
      for (let i = 0; i + 1 < coords.length; i += 2) {
        points.push({ x: coords[i], y: coords[i + 1] })
      }
      return { classId, points }
    })
    .filter(
      (polygon) =>
        Number.isFinite(polygon.classId) &&
        polygon.points.length >= 3 &&
        polygon.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    )
}

/** Converts a normalized YOLO-seg polygon into the labeler's absolute-pixel point list. */
export const yoloPolygonToPoints = (
  polygon: YoloPolygon,
  imageWidth: number,
  imageHeight: number
): IPoint[] =>
  polygon.points.map((p) => ({
    id: makeUUID(),
    x: p.x * imageWidth,
    y: p.y * imageHeight
  }))

export type YoloImagePair = {
  image: VirtualFile
  label: VirtualFile | null
  split: TrainingSplit
}

const IMAGES_DIR_PATTERN = /(^|\/)images\//

/** Pairs each image with its YOLO label file, checked in the same directory first (flat
 *  layouts) and then via the Ultralytics `images/` -> `labels/` sibling-directory
 *  convention. Images without a matching label are kept (imported with no annotations)
 *  rather than dropped. Images under a val/valid/validation folder default to the Valid
 *  split, a test folder to Test, and everything else to Train - there's no UI for this
 *  since it just mirrors the dataset's own folder structure. */
export const findYoloImagePairs = (files: VirtualFile[]): YoloImagePair[] => {
  const byPath = new Map(files.map((f) => [f.path, f] as const))

  return files
    .filter((f) => IMAGE_EXTENSIONS.has(extensionOf(f.path)))
    .map((image) => {
      const stem = withoutExtension(image.path)
      const label =
        byPath.get(`${stem}.txt`) ??
        byPath.get(`${stem.replace(IMAGES_DIR_PATTERN, '$1labels/')}.txt`) ??
        null
      const split = splitFromPath(image.path)

      return { image, label, split }
    })
}

/** Every distinct class id actually referenced by the dataset's label files, used to build
 *  a fallback class list ("Class 0", "Class 1", ...) when there's no data.yaml/classes.txt. */
export const findReferencedClassIds = async (pairs: YoloImagePair[]): Promise<number[]> => {
  const ids = new Set<number>()
  for (const pair of pairs) {
    if (!pair.label) continue
    for (const box of parseYoloLabelFile(await pair.label.text())) {
      ids.add(box.classId)
    }
  }
  return Array.from(ids).sort((a, b) => a - b)
}

/** Gets the image's pixel dimensions (needed to normalize box/polygon coordinates) and a
 *  scratch-file imagePath. A disk-backed pair (extracted from a zip) already has a real
 *  file - its dimensions are read directly via sharp (main-process, no bytes cross into
 *  the renderer) and its diskPath is reused as-is, no extra copy. A blob-backed pair (a
 *  picked folder) has no on-disk file yet, so it's decoded once via createImageBitmap for
 *  its dimensions and then written to scratchDir. */
const resolveImagePathAndDimensions = async (
  image: VirtualFile,
  scratchDir: string
): Promise<{ imagePath: string; width: number; height: number }> => {
  if (image.diskPath) {
    const { width, height } = await window.system.getImageDimensions(image.diskPath)
    return { imagePath: image.diskPath, width, height }
  }

  const blob = await image.blob()
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  bitmap.close()
  const imagePath = await writeBlobToScratchFile(scratchDir, blob, extensionOf(image.path))
  return { imagePath, width, height }
}

const buildSampleFromYoloPair = async (
  pair: YoloImagePair,
  classIdToLabelId: Map<number, string | null>,
  format: YoloLabelFormat,
  scratchDir: string
): Promise<INewSample> => {
  const { imagePath, width, height } = await resolveImagePathAndDimensions(pair.image, scratchDir)

  const annotations: INewAnnotation[] = []
  if (pair.label) {
    const text = await pair.label.text()
    if (format === YoloLabelFormat.Segmentation) {
      for (const polygon of parseYoloSegmentationLabelFile(text)) {
        const labelId = classIdToLabelId.get(polygon.classId)
        if (labelId === undefined || labelId === null) continue
        annotations.push({
          id: makeUUID(),
          type: AnnotationType.Polygon,
          labelId,
          points: yoloPolygonToPoints(polygon, width, height)
        })
      }
    } else {
      for (const box of parseYoloLabelFile(text)) {
        const labelId = classIdToLabelId.get(box.classId)
        if (labelId === undefined || labelId === null) continue
        annotations.push({
          id: makeUUID(),
          type: AnnotationType.Box,
          labelId,
          points: yoloBoxToPoints(box, width, height)
        })
      }
    }
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

/** Converts the whole dataset to samples, one image at a time (not in parallel - datasets
 *  can run into the thousands of images, and decoding many at once risks spiking memory).
 *  `format` picks how every label line in the dataset is interpreted - YOLO's own label
 *  files don't self-describe this, and a dataset is conventionally all-detection or
 *  all-segmentation, so it's one choice for the whole import rather than inferred per line. */
export const yoloDatasetToSamples = async (
  pairs: YoloImagePair[],
  classIdToLabelId: Map<number, string | null>,
  format: YoloLabelFormat,
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  const samples: INewSample[] = []
  for (const pair of pairs) {
    samples.push(await buildSampleFromYoloPair(pair, classIdToLabelId, format, scratchDir))
    onProgress?.(samples.length, pairs.length)
  }
  return samples
}
