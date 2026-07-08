import type { HitTestResult, LabelerStore } from '@renderer/hooks/useLabeler'
import type { StoreApi, UseBoundStore } from 'zustand'

export type Point = { x: number; y: number }

export enum PointerResult {
  /** The tool fully handled the gesture; suppress the default behavior (panning for
   * a left-click, the contextmenu popup for a right-click). */
  Consumed = 'consumed',
  /** Let the default behavior also run (e.g. deselecting still allows a drag on
   * empty canvas to pan). */
  Default = 'default'
}

export type StartDragFn = (onMove: (x: number, y: number) => void, onRelease?: () => void) => void

export type LabelerToolContext = {
  store: UseBoundStore<StoreApi<LabelerStore>>
  startDrag: StartDragFn
}

export interface LabelerTool {
  onPointerDown?(ctx: LabelerToolContext, pos: Point, hit: HitTestResult | null): PointerResult
  onRightPointerDown?(ctx: LabelerToolContext, pos: Point, hit: HitTestResult | null): PointerResult
}
