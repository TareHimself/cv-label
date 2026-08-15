import { clamp } from '@mantine/hooks'
import { AnnotationType } from '@shared/types'
import { PointerResult, type LabelerTool } from './types'

const MAX_BITMAP_COORDINATE = 9_000_000

export const selectTool: LabelerTool = {
  onPointerDown(ctx, pos, hit) {
    let state = ctx.store.getState()

    if (hit === null) {
      state.selectAnnotation(null)
      return PointerResult.Default
    }

    // First figure out selection, then do other ops.
    if (
      state.selectedAnnotation !== null &&
      state.selectedAnnotation.resolve().id !== hit.annotationId
    ) {
      state.selectAnnotation(null)
      state = ctx.store.getState()
    }

    if (state.selectedAnnotation === null) {
      state.selectAnnotation(hit.annotationId)
      return PointerResult.Consumed
    }

    if (state.selectedAnnotation.resolve().id !== hit.annotationId) {
      return PointerResult.Default
    }

    let controlPointId = hit.controlPointId
    if (hit.lineControlPointId !== null) {
      // A Box only ever has 2 real points - its "lines" are edges, draggable to resize
      // rather than a place to insert a new point (unlike a Polygon's lines).
      if (state.selectedAnnotation.resolve().type === AnnotationType.Box) {
        controlPointId = hit.lineControlPointId
      } else {
        controlPointId = state.addControlPoint(hit.lineControlPointId, pos.x, pos.y) ?? null
      }
    }

    // Move a single control point.
    if (controlPointId !== null) {
      const pointId = controlPointId
      const annotationId = state.selectedAnnotation.resolve().id
      ctx.startDrag(
        (x, y) => state.moveAnnotationPoint(pointId, x, y),
        () => state.commitAnnotationMove(annotationId)
      )
      return PointerResult.Consumed
    }

    // Move the whole annotation, clamped so it can't be dragged off the bitmap.
    const annotationId = state.selectedAnnotation.resolve().id
    const initialPoints = structuredClone(state.selectedAnnotation.resolve().points)
    const minPoints = initialPoints.reduce(
      (t, c) => ({ x: Math.min(c.x, t.x), y: Math.min(c.y, t.y) }),
      { x: initialPoints[0].x, y: initialPoints[0].y }
    )
    const maxPoints = initialPoints.reduce(
      (t, c) => ({ x: Math.max(c.x, t.x), y: Math.max(c.y, t.y) }),
      { x: initialPoints[0].x, y: initialPoints[0].y }
    )
    const [startX, startY] = state.canvasToBitmapSpace(pos.x, pos.y)
    const [endX, endY] = state.canvasToBitmapSpace(MAX_BITMAP_COORDINATE, MAX_BITMAP_COORDINATE)
    const allowedDiffTowardsMinimum = [-minPoints.x, -minPoints.y]
    const allowedDiffTowardMaximum = [endX - maxPoints.x, endY - maxPoints.y]

    ctx.startDrag(
      (x, y) => {
        const [currentX, currentY] = state.canvasToBitmapSpace(x, y)
        const dx = clamp(
          currentX - startX,
          allowedDiffTowardsMinimum[0],
          allowedDiffTowardMaximum[0]
        )
        const dy = clamp(
          currentY - startY,
          allowedDiffTowardsMinimum[1],
          allowedDiffTowardMaximum[1]
        )
        state.moveSelectedAnnotationBy(dx, dy)
      },
      () => state.commitAnnotationMove(annotationId)
    )
    return PointerResult.Consumed
  },

  onRightPointerDown(ctx, _pos, hit) {
    if (hit !== null && hit.controlPointId !== null) {
      ctx.store.getState().deleteControlPoint(hit.controlPointId)
      return PointerResult.Consumed
    }
    return PointerResult.Default
  }
}
