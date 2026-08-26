import { AnnotationType, IAnnotation, ILabel } from '@shared/types'
import { boundingBoxOf, exportShapePoints, ExportShape, polygonArea } from '../annotationShape'

/** COCO can carry an independent optional segmentation alongside a bbox, so unlike YOLO there's a third mode: Native, leaving each annotation's segmentation as whatever it actually has. */
export enum CocoShapeMode {
  Box = 'box',
  Segment = 'segment',
  Native = 'native'
}

export type CocoImage = {
  id: number
  file_name: string
  width: number
  height: number
}

export type CocoAnnotation = {
  id: number
  image_id: number
  category_id: number
  bbox: [number, number, number, number]
  area: number
  segmentation: number[][]
  iscrowd: 0
}

export type CocoCategory = {
  id: number
  name: string
  supercategory: string
}

/** COCO category ids are conventionally 1-indexed (0 is reserved in some tools for a background/superclass placeholder). */
export const buildCocoCategories = (labels: ILabel[]): CocoCategory[] =>
  labels.map((label, index) => ({ id: index + 1, name: label.name, supercategory: 'none' }))

const cocoSegmentationFor = (
  annotation: Pick<IAnnotation, 'type' | 'points'>,
  mode: CocoShapeMode
): number[][] => {
  if (mode === CocoShapeMode.Box) return []
  if (mode === CocoShapeMode.Native && annotation.type === AnnotationType.Box) return []
  return [exportShapePoints(annotation, ExportShape.Segment).flatMap((p) => [p.x, p.y])]
}

/** `bbox` is always the bounding box. `segmentation` depends on mode: Box discards shape entirely, Segment synthesizes one for every annotation, Native leaves it as-is. `area` uses the real polygon area only when one is actually exported. */
export const buildCocoAnnotations = (
  annotations: IAnnotation[],
  imageId: number,
  labelIdToCategoryId: Map<string, number>,
  nextAnnotationId: () => number,
  mode: CocoShapeMode
): CocoAnnotation[] => {
  const result: CocoAnnotation[] = []

  for (const annotation of annotations) {
    if (annotation.points.length < 2) continue
    const categoryId = labelIdToCategoryId.get(annotation.labelId)
    if (categoryId === undefined) continue

    const box = boundingBoxOf(annotation.points)
    const isRealPolygon = mode !== CocoShapeMode.Box && annotation.type === AnnotationType.Polygon

    result.push({
      id: nextAnnotationId(),
      image_id: imageId,
      category_id: categoryId,
      bbox: [box.minX, box.minY, box.width, box.height],
      area: isRealPolygon ? polygonArea(annotation.points) : box.width * box.height,
      segmentation: cocoSegmentationFor(annotation, mode),
      iscrowd: 0
    })
  }

  return result
}

export const cocoImagePath = (sampleId: string, split: string, extension: string): string =>
  `${split}/${sampleId}.${extension}`

export const cocoAnnotationsFilePath = (split: string): string => `${split}/_annotations.coco.json`
