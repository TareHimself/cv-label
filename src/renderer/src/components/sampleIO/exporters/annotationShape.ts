import { AnnotationType, IAnnotation, IPoint } from '@shared/types'

export enum ExportShape {
  Box = 'box',
  Segment = 'segment'
}

export type BoundingBox = {
  minX: number
  minY: number
  width: number
  height: number
}

export const boundingBoxOf = (points: IPoint[]): BoundingBox => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

/** Shoelace formula for a simple polygon's area. */
export const polygonArea = (points: IPoint[]): number => {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

const rectangleCorners = (box: BoundingBox): { x: number; y: number }[] => [
  { x: box.minX, y: box.minY },
  { x: box.minX + box.width, y: box.minY },
  { x: box.minX + box.width, y: box.minY + box.height },
  { x: box.minX, y: box.minY + box.height }
]

/** The polygon to export for an annotation under the given shape mode. In Segment mode a
 *  Polygon keeps its real outline and a Box becomes its own 4 corners (a box has no shape
 *  beyond its rectangle). In Box mode every annotation - Polygon included - is flattened
 *  to its bounding rectangle's corners, discarding a Polygon's actual outline. Either way
 *  every annotation produces a usable shape, unlike formats that can only carry one kind. */
export const exportShapePoints = (
  annotation: Pick<IAnnotation, 'type' | 'points'>,
  shape: ExportShape
): { x: number; y: number }[] => {
  if (shape === ExportShape.Segment && annotation.type === AnnotationType.Polygon) {
    return annotation.points
  }
  return rectangleCorners(boundingBoxOf(annotation.points))
}
