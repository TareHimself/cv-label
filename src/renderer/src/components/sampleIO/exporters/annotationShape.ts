import { AnnotationType, IAnnotation } from '@shared/types'
import { boundingBoxOf, type BoundingBox } from '@renderer/util/boundingBox'

export enum ExportShape {
  Box = 'box',
  Segment = 'segment'
}

const rectangleCorners = (box: BoundingBox): { x: number; y: number }[] => [
  { x: box.minX, y: box.minY },
  { x: box.minX + box.width, y: box.minY },
  { x: box.minX + box.width, y: box.minY + box.height },
  { x: box.minX, y: box.minY + box.height }
]

/** In Segment mode a Polygon keeps its real outline (a Box becomes its own 4 corners); in Box mode every annotation flattens to its bounding rectangle. Either way every annotation produces a usable shape. */
export const exportShapePoints = (
  annotation: Pick<IAnnotation, 'type' | 'points'>,
  shape: ExportShape
): { x: number; y: number }[] => {
  if (shape === ExportShape.Segment && annotation.type === AnnotationType.Polygon) {
    return annotation.points
  }
  return rectangleCorners(boundingBoxOf(annotation.points))
}
