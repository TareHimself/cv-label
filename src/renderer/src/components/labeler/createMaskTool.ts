import { PointerResult, type LabelerTool } from './types'

export const createMaskTool: LabelerTool = {
  onPointerDown(ctx, pos) {
    ctx.store.getState().onConfirmPoint(pos.x, pos.y)
    return PointerResult.Consumed
  },

  onRightPointerDown(ctx) {
    const state = ctx.store.getState()
    if ((state.annotationBeingCreated?.points.length ?? 0) >= 4) {
      state.onConfirmAnnotationCreation(true)
      return PointerResult.Consumed
    }
    return PointerResult.Default
  }
}
