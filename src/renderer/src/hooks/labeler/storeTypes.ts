import { LabelerMode, OptimisticSample } from '@renderer/types'
import { AnnotationType, IAnnotation, ILabel, INewAnnotation, IPoint } from '@shared/types'
import { OptimisticObject } from '@renderer/util/optimistic_object'
import type { OneToOneMap } from './hitIds'

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type Vector2 = [number, number]

export type LabelerStoreState = {
  imageHitId: string
  sizeDirty: boolean
  imageDirty: boolean
  annotationDirty: boolean
  hitTestDirty: boolean
  imageRect: Rect
  bitmap: ImageBitmap | null
  canvasSize: Vector2
  scale: number
  mousePos: Vector2
  /** General-purpose xy diff applied contextually to some item. */
  moveCurrent: Vector2
  pointIdsBeingMoved: string[] | null
  /** Parallel to pointIdsBeingMoved - which axis each point gets; null means both (the default outside a Box's 2 derived corners). */
  pointIdsBeingMovedAxis: ('x' | 'y' | 'xy')[] | null
  annotationIdBeingMoved: string | null
  mode: LabelerMode
  showHitTestDebugOverlay: boolean

  sample: OptimisticSample | null

  readonly annotationsPendingDelete: Set<string>
  readonly hitTestCanvas: OffscreenCanvas

  isDragging: boolean
  selectedAnnotation: OptimisticObject<IAnnotation> | null
  readonly hitIdToAnnotationId: OneToOneMap<string, string>
  readonly selectedAnnotationControlHitIds: OneToOneMap<string, string>
  readonly selectedAnnotationLineHitIds: OneToOneMap<string, string>
  selectedLabelId: string
  annotationBeingCreated: INewAnnotation | null
  readonly labelsMap: Record<string, ILabel>

  /** Whether the mouse is over the AnnotationsDrawer's row list - drives the canvas dim; broader than hoveredAnnotationId to avoid flicker between rows. */
  isAnnotationsDrawerHovered: boolean
  /** The currently row-hovered annotation, if any - unlike selectedAnnotation, doesn't persist across mouse movement. */
  hoveredAnnotationId: string | null

  /** Per-sample undo/redo history, cleared on setSample. */
  readonly undoStack: HistoryEntry[]
  readonly redoStack: HistoryEntry[]
}

export type HitTestResult =
  | {
      annotationId: string | null
      controlPointId: null
      lineControlPointId: null
    }
  | {
      annotationId: string
      controlPointId: string
      lineControlPointId: string | null
    }
  | {
      annotationId: string
      controlPointId: string | null
      lineControlPointId: string
    }

export type HistoryEntry =
  | { kind: 'create'; annotation: IAnnotation }
  | { kind: 'delete'; annotation: IAnnotation }
  | { kind: 'points'; annotationId: string; before: IPoint[]; after: IPoint[] }
  | { kind: 'relabel'; annotationId: string; beforeLabelId: string; afterLabelId: string }
  | {
      kind: 'convert'
      annotationId: string
      beforeType: AnnotationType
      beforePoints: IPoint[]
      afterType: AnnotationType
      afterPoints: IPoint[]
    }

export type LabelerStoreActions = {
  markAllDirty: () => void
  preDraw: () => void
  onCanvasResize: (width: number, height: number) => void
  setSample: (sample: OptimisticSample) => void
  /** Aborts an in-flight bitmap load without restarting it - for leaving the page mid-load. */
  cancelPendingSampleLoad: () => void
  onBitmapLoaded: (bitmap: ImageBitmap) => void
  zoom: (x: number, y: number, delta: number) => void
  zoomIn: (anchor?: 'center' | 'mouse') => void
  zoomOut: (anchor?: 'center' | 'mouse') => void
  setZoom: (zoom: number) => void
  setMode: (mode: LabelerMode) => void
  setLabelId: (labelId: string) => void
  selectAnnotation: (id: string | null) => void
  /** Escape: deselects, or else drops back to Select mode. */
  cancelActiveAction: () => void
  onMouseMove: (x: number, y: number) => void
  onConfirmPoint: (x: number, y: number) => void
  onConfirmAnnotationCreation: (discardLivePoint?: boolean) => void
  setAnnotationLabelId: (annotationId: string, newLabelId: string) => void
  moveSelectedAnnotationBy: (dx: number, dy: number) => void
  moveAnnotationPoint: (pointId: string, x: number, y: number) => void
  commitAnnotationMove: (annotationId: string) => void
  setShowHitTestDebugOverlay: (enabled: boolean) => void
  canvasToBitmapSpace: (x: number, y: number) => [x: number, y: number]
  deleteAnnotation: (annotationId: string) => void
  deleteSelectedAnnotation: () => void
  duplicateAnnotation: (annotationId: string) => string | undefined
  duplicateSelectedAnnotation: () => void
  convertAnnotationType: (annotationId: string) => void
  addControlPoint: (lineId: string, x: number, y: number) => string | undefined
  deleteControlPoint: (controlPointId: string) => void
  hittest: (x: number, y: number) => HitTestResult | null
  setHoveredAnnotation: (id: string | null) => void
  setAnnotationsDrawerHovered: (hovered: boolean) => void
  undo: () => void
  redo: () => void
}

export type LabelerStore = LabelerStoreState & LabelerStoreActions
