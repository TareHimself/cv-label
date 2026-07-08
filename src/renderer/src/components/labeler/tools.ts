import { LabelerMode } from '@renderer/types'
import type { LabelerTool } from './types'
import { selectTool } from './selectTool'
import { createBoxTool } from './createBoxTool'
import { createMaskTool } from './createMaskTool'

export const tools: Record<LabelerMode, LabelerTool> = {
  [LabelerMode.Select]: selectTool,
  [LabelerMode.CreateBox]: createBoxTool,
  [LabelerMode.CreateMask]: createMaskTool
}

export { PointerResult } from './types'
export type { LabelerTool, LabelerToolContext, Point, StartDragFn } from './types'
