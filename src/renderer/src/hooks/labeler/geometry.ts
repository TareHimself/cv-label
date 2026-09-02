import { makeUUID } from '@shared/utils'
import { AnnotationType, IAnnotation, INewAnnotation, IPoint } from '@shared/types'
import { boundingBoxOf, type BoundingBox } from '@renderer/util/boundingBox'
import type { Rect, Vector2 } from './storeTypes'

/** Below this on-screen size (any zoom), a just-drawn box is treated as an accidental click, not a real annotation. */
export const MIN_BOX_SCREEN_SIZE_PX = 8

export const normalizeAnnotationPoints = <T extends Pick<IAnnotation, 'type' | 'points'>>(
  annotation: T
) => {
  const fixedAnnotation = structuredClone(annotation)
  if (annotation.type === AnnotationType.Box && annotation.points.length === 2) {
    const [p0, p1] = fixedAnnotation.points
    const minX = Math.min(p0.x, p1.x)
    const minY = Math.min(p0.y, p1.y)
    const maxX = Math.max(p0.x, p1.x)
    const maxY = Math.max(p0.y, p1.y)

    p0.x = minX
    p0.y = minY
    p1.x = maxX
    p1.y = maxY
  }

  return fixedAnnotation
}

/** How much of moveCurrent applies to one point mid-drag - the full delta unless axis-masked (a Box's 2 derived corners); [0, 0] if not part of the drag. */
export const axisMaskedMoveDelta = (
  pointId: string,
  pointIdsBeingMoved: string[] | null,
  pointIdsBeingMovedAxis: ('x' | 'y' | 'xy')[] | null,
  moveCurrent: Vector2
): Vector2 => {
  const idx = pointIdsBeingMoved?.indexOf(pointId) ?? -1
  if (idx === -1) return [0, 0]
  const axis = pointIdsBeingMovedAxis?.[idx] ?? 'xy'
  return [axis === 'y' ? 0 : moveCurrent[0], axis === 'x' ? 0 : moveCurrent[1]]
}

const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y

/** Rejects a Box whose raw (pre-clamp) extent doesn't touch the image at all, or whose on-screen size is too small to be intentional - a box can legitimately start inside and end outside (dragged to the edge, clamped) or vice versa, so this checks the drawn rectangle against the image, not either single corner. */
export const isValidBoxCreation = (
  rawStart: Vector2 | null,
  rawEnd: Vector2,
  imageRect: Rect,
  scale: number,
  annotation: INewAnnotation
): boolean => {
  if (rawStart === null) return false

  const rawExtent: Rect = {
    x: Math.min(rawStart[0], rawEnd[0]),
    y: Math.min(rawStart[1], rawEnd[1]),
    width: Math.abs(rawEnd[0] - rawStart[0]),
    height: Math.abs(rawEnd[1] - rawStart[1])
  }
  if (!rectsIntersect(rawExtent, imageRect)) return false

  const box = boundingBoxOf(annotation.points)
  return box.width * scale >= MIN_BOX_SCREEN_SIZE_PX && box.height * scale >= MIN_BOX_SCREEN_SIZE_PX
}

/** A Box's 2 points become a Polygon's 4 corners, with fresh point ids. */
export const boxPointsToPolygonPoints = (points: IPoint[]): IPoint[] => {
  const [topLeft, bottomRight] = points
  return [
    { id: makeUUID(), x: topLeft.x, y: topLeft.y },
    { id: makeUUID(), x: bottomRight.x, y: topLeft.y },
    { id: makeUUID(), x: bottomRight.x, y: bottomRight.y },
    { id: makeUUID(), x: topLeft.x, y: bottomRight.y }
  ]
}

/** A Polygon reduces to its axis-aligned bounding box - necessarily lossy for a non-rectangular outline. */
export const polygonPointsToBoxPoints = (points: IPoint[]): IPoint[] => {
  const box = boundingBoxOf(points)
  return [
    { id: makeUUID(), x: box.minX, y: box.minY },
    { id: makeUUID(), x: box.minX + box.width, y: box.minY + box.height }
  ]
}

const DUPLICATE_OFFSET_RATIO = 0.08
const DUPLICATE_OFFSET_MIN = 12

/** How far a duplicate is nudged, scaled to its own size so tiny/huge annotations both offset sensibly. */
export const duplicateOffsetFor = (box: BoundingBox): number =>
  Math.max(DUPLICATE_OFFSET_MIN, Math.max(box.width, box.height) * DUPLICATE_OFFSET_RATIO)

/** Nudges a duplicate's axis by desired, flipping direction or shrinking it to keep the bounding box inside [0, extent]. */
export const clampedDuplicateAxisOffset = (
  min: number,
  size: number,
  extent: number,
  desired: number
) => {
  const spaceAfter = extent - (min + size)
  const spaceBefore = min
  if (spaceAfter >= desired) return desired
  if (spaceBefore >= desired) return -desired
  return spaceAfter >= spaceBefore ? spaceAfter : -spaceBefore
}
