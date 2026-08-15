import { LabelerMode } from '@renderer/types'
import type { LabelerTool } from './types'
import { selectTool } from './selectTool'
import { createBoxTool } from './createBoxTool'
import { createPolygonTool } from './createPolygonTool'

export const tools: Record<LabelerMode, LabelerTool> = {
  [LabelerMode.Select]: selectTool,
  [LabelerMode.CreateBox]: createBoxTool,
  [LabelerMode.CreatePolygon]: createPolygonTool
}

export { PointerResult } from './types'
export type { LabelerTool, LabelerToolContext, Point, StartDragFn } from './types'
