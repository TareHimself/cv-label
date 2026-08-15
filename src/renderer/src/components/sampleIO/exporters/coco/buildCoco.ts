import { AnnotationType, IAnnotation, ILabel } from '@shared/types'
import { boundingBoxOf, exportShapePoints, ExportShape, polygonArea } from '../annotationShape'

/** Unlike YOLO's fixed-column label lines, a COCO annotation entry can carry a bbox and
 *  an independent (optional) segmentation, so it supports a third choice beyond forcing
 *  every annotation to one shape: Native, which leaves each annotation's segmentation as
 *  whatever it actually has - none for a Box, its real outline for a Polygon. */
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

/** COCO category ids are conventionally 1-indexed (0 is reserved in some tools for a
 *  background/superclass placeholder). */
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

/** Converts one sample's annotations to COCO annotation entries. `bbox` is always the
 *  annotation's own bounding box. `segmentation` depends on the mode: Box discards any
 *  shape entirely (pure detection data, even for a Polygon); Segment gives every
 *  annotation a polygon (a Box's own 4 corners, synthesized, if it has no real one);
 *  Native leaves a Box with no segmentation (it never had one) and a Polygon with its
 *  real outline. `area` uses the real polygon's area only when that's what's actually
 *  being exported. */
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
