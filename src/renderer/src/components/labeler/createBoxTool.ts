import { PointerResult, type LabelerTool } from './types'

export const createBoxTool: LabelerTool = {
  onPointerDown(ctx, pos) {
    ctx.store.getState().onConfirmPoint(pos.x, pos.y)

    ctx.startDrag(
      (x, y) => {
        ctx.store.getState().onMouseMove(x, y)
      },
      () => {
        const releaseState = ctx.store.getState()
        if (releaseState.annotationBeingCreated?.points.length === 2) {
          releaseState.onConfirmAnnotationCreation()
        }
      }
    )
    return PointerResult.Consumed
  },

  onRightPointerDown(ctx) {
    const state = ctx.store.getState()
    if (state.annotationBeingCreated?.points.length === 2) {
      state.onConfirmAnnotationCreation()
      return PointerResult.Consumed
    }
    return PointerResult.Default
  }
}
