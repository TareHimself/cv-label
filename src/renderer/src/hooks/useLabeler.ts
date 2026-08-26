import { LabelerMode, OptimisticSample } from '@renderer/types'
import { rgb2hex } from '@shared/color'
import { AnnotationType, IAnnotation, ILabel, INewAnnotation, IPoint } from '@shared/types'
import { create } from 'zustand'
import { useMemo } from 'react'
import { makeUUID } from '@shared/utils'
import { clamp } from '@mantine/hooks'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { OptimisticObject } from '@renderer/util/optimistic_object'
import { ColorGenerator } from '@renderer/util/color_generator'
import {
  boundingBoxOf,
  type BoundingBox
} from '@renderer/components/sampleIO/exporters/annotationShape'

const ZOOM_STEP_DELTA = 0.15
const MIN_ZOOM = 0.05
const MAX_ZOOM = 32

/** Sentinels for a Box's 2 derived corner handles (see moveAnnotationPoint) - safe as fixed literals since only one Box is ever selected at a time. */
export const BOX_CORNER_HANDLE_TOP_RIGHT = '__box-corner-top-right__'
export const BOX_CORNER_HANDLE_BOTTOM_LEFT = '__box-corner-bottom-left__'

/** A Box's 4 resizable edges (see moveAnnotationPoint) - unlike a Polygon's lines, these never go through addControlPoint. */
export const BOX_EDGE_TOP = '__box-edge-top__'
export const BOX_EDGE_RIGHT = '__box-edge-right__'
export const BOX_EDGE_BOTTOM = '__box-edge-bottom__'
export const BOX_EDGE_LEFT = '__box-edge-left__'

const createLabelsMap = (labels: ILabel[]) => {
  const labelsMap: Record<string, ILabel> = {}
  for (const label of labels) {
    labelsMap[label.id] = label
  }

  return labelsMap
}

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

  // Could become problematic so removed for now
  // fixedAnnotation.points = fixedAnnotation.points.map((c) => ({
  //   id: c.id,
  //   x: Math.round(c.x),
  //   y: Math.round(c.y)
  // }))

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

const loadBitmap = (uri: string, signal?: AbortSignal) => {
  return new Promise<ImageBitmap>((res, rej) => {
    const image = new Image()
    image.addEventListener('load', () => {
      createImageBitmap(image).then(res).catch(rej)
    })
    image.addEventListener('error', (e) => {
      rej(e)
    })

    if (signal !== undefined) {
      signal.addEventListener('abort', () => rej('Aborted'))
      try {
        signal.throwIfAborted()
      } catch (error) {
        rej(error)
      }
    }

    image.src = uri
  })
}

class OneToOneMap<T, K> {
  toValue: Map<T, K>
  toKey: Map<K, T>
  constructor() {
    this.toValue = new Map()
    this.toKey = new Map()
  }

  set(key: T, value: K) {
    this.toValue.set(key, value)
    this.toKey.set(value, key)
  }

  get(key: T) {
    return this.toValue.get(key)
  }

  getByValue(value: K) {
    return this.toKey.get(value)
  }

  delete(key: T) {
    const other = this.toValue.get(key)
    if (other !== undefined) {
      this.toValue.delete(key)
      this.toKey.delete(other)
    }
  }

  deleteByValue(value: K) {
    const other = this.toKey.get(value)
    if (other !== undefined) {
      this.toKey.delete(value)
      this.toValue.delete(other)
    }
  }

  clear() {
    this.toKey.clear()
    this.toValue.clear()
  }

  keys() {
    return this.toValue.keys()
  }

  values() {
    return this.toValue.values()
  }
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type Vector2 = [number, number]

type LabelerStoreState = {
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

type LabelerStoreActions = {
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

export const useLabeler = (labels: ILabel[]) => {
  const store = useMemo(
    () =>
      create<LabelerStore>((set, get) => {
        const colorGenerator = new ColorGenerator()
        let activeSampleAbort: AbortController | null = null
        const imageHitId = colorGenerator.make()
        const labelsMap = createLabelsMap(labels)
        const hitIdToAnnotationId = new OneToOneMap<string, string>()
        const selectedAnnotationControlHitIds = new OneToOneMap<string, string>()
        const selectedAnnotationLineHitIds = new OneToOneMap<string, string>()

        const makeHitId = () => {
          return colorGenerator.make()
        }

        const freeHitId = (id: string) => {
          colorGenerator.free(id)
        }

        const clearSelectedAnnotationHitIds = () => {
          for (const hitId of selectedAnnotationControlHitIds.keys()) {
            freeHitId(hitId)
          }

          for (const hitId of selectedAnnotationLineHitIds.keys()) {
            freeHitId(hitId)
          }

          selectedAnnotationControlHitIds.clear()
          selectedAnnotationLineHitIds.clear()
        }

        /** Rebuilds a selected annotation's hit ids from scratch - a Box's derived corner/edge handles only ever get set up here, not per-point. */
        const rebuildSelectedAnnotationHitIds = (annotation: IAnnotation) => {
          clearSelectedAnnotationHitIds()

          for (const point of annotation.points) {
            selectedAnnotationControlHitIds.set(makeHitId(), point.id)
          }

          if (annotation.type === AnnotationType.Polygon) {
            for (const point of annotation.points) {
              selectedAnnotationLineHitIds.set(makeHitId(), point.id)
            }
          } else if (annotation.type === AnnotationType.Box) {
            selectedAnnotationControlHitIds.set(makeHitId(), BOX_CORNER_HANDLE_TOP_RIGHT)
            selectedAnnotationControlHitIds.set(makeHitId(), BOX_CORNER_HANDLE_BOTTOM_LEFT)
            selectedAnnotationLineHitIds.set(makeHitId(), BOX_EDGE_TOP)
            selectedAnnotationLineHitIds.set(makeHitId(), BOX_EDGE_RIGHT)
            selectedAnnotationLineHitIds.set(makeHitId(), BOX_EDGE_BOTTOM)
            selectedAnnotationLineHitIds.set(makeHitId(), BOX_EDGE_LEFT)
          }
        }

        const addSelectedAnnotationPointId = (pointId: string) => {
          clearSelectedAnnotationPointId(pointId)
          {
            const hitId = makeHitId()
            selectedAnnotationControlHitIds.set(hitId, pointId)
          }
          {
            const hitId = makeHitId()
            selectedAnnotationLineHitIds.set(hitId, pointId)
          }
        }

        const clearSelectedAnnotationPointId = (pointId: string) => {
          {
            const hitId = selectedAnnotationControlHitIds.getByValue(pointId)
            if (hitId !== undefined) {
              freeHitId(hitId)
              selectedAnnotationControlHitIds.delete(pointId)
            }
          }
          {
            const hitId = selectedAnnotationLineHitIds.getByValue(pointId)
            if (hitId !== undefined) {
              freeHitId(hitId)
              selectedAnnotationLineHitIds.delete(pointId)
            }
          }
        }

        const freeAnnotationHitIds = (annotationId: string) => {
          const hitId = hitIdToAnnotationId.getByValue(annotationId)
          if (hitId !== undefined) {
            freeHitId(hitId)
            hitIdToAnnotationId.delete(hitId)
          }
          if (annotationId === get().selectedAnnotation?.resolve().id) {
            clearSelectedAnnotationHitIds()
          }
        }

        const addAnnotationHitIds = (annotationId: string) => {
          const hitId = makeHitId()
          hitIdToAnnotationId.set(hitId, annotationId)
        }

        const canvasToBitmapSpace = (x: number, y: number): [x: number, y: number] => {
          const state = get()
          if (state.bitmap === null) {
            return [0, 0]
          }

          const xScale = state.bitmap.width / state.imageRect.width
          const yScale = state.bitmap.height / state.imageRect.height
          const newX = clamp((x - state.imageRect.x) * xScale, 0, state.bitmap.width)
          const newY = clamp((y - state.imageRect.y) * yScale, 0, state.bitmap.height)

          return [newX, newY]
        }

        const createPendingAnnotation = (
          type: AnnotationType,
          labelId: string,
          mousePos: Vector2
        ) => {
          const [x, y] = canvasToBitmapSpace(...mousePos)
          return {
            id: makeUUID(),
            labelId,
            type,
            points: [
              {
                id: makeUUID(),
                x,
                y
              }
            ]
          } satisfies INewAnnotation
        }

        const fitBitmapToCanvas = () => {
          const state = get()
          if (state.bitmap === null) {
            return
          }

          const bitmapWidth = state.bitmap.width
          const bitmapHeight = state.bitmap.height
          const [canvasWidth, canvasHeight] = state.canvasSize
          const scale = Math.min(canvasWidth / bitmapWidth, canvasHeight / bitmapHeight)

          const newBitmapWidth = bitmapWidth * scale
          const newBitmapHeight = bitmapHeight * scale
          const x1 = (canvasWidth - newBitmapWidth) / 2
          const y1 = (canvasHeight - newBitmapHeight) / 2

          set({
            imageRect: {
              x: x1,
              y: y1,
              width: newBitmapWidth,
              height: newBitmapHeight
            }
          })
        }

        const getCanvasCenter = (): Vector2 => {
          const [canvasWidth, canvasHeight] = get().canvasSize
          return [canvasWidth / 2, canvasHeight / 2]
        }

        const getZoomAnchor = (anchor: 'center' | 'mouse' = 'center'): Vector2 => {
          if (anchor === 'mouse') {
            const [mouseX, mouseY] = get().mousePos
            return [mouseX, mouseY]
          }

          return getCanvasCenter()
        }

        /** Records an undoable mutation and drops redo history, like standard editor undo. */
        const pushHistory = (entry: HistoryEntry) =>
          set((state) => ({ undoStack: [...state.undoStack, entry], redoStack: [] }))

        /** Optimistically creates annotation then persists it - shared by creation and undo/redo. */
        const applyCreateAnnotation = (annotation: IAnnotation) => {
          const state = get()
          if (state.sample === null) return

          const dataStore = useAppStore.getState().store
          const annotations = state.sample.resolve().annotations
          const newAnnotation = new OptimisticObject(annotation)
          const { commit, rollback } = annotations.update({
            [annotation.id]: newAnnotation
          })

          const sampleId = state.sample.resolve().id
          set({ annotationDirty: true })
          dataStore
            .createAnnotations(sampleId, [annotation])
            .then((results) => {
              newAnnotation.updateBase(results[0])
              commit()
              if (sampleId === get().sample?.resolve().id) {
                addAnnotationHitIds(results[0].id)
                set({ annotationDirty: true, hitTestDirty: true })
              }
            })
            .catch(() => {
              rollback()
              if (sampleId === get().sample?.resolve().id) {
                set({ annotationDirty: true })
              }
            })
        }

        /** Optimistically removes annotationId then persists the delete - shared by deleteAnnotation and undo/redo. */
        const applyDeleteAnnotation = (annotationId: string) => {
          const state = get()
          const annotations = state.sample?.resolve().annotations
          if (annotations === undefined) return

          const annotation = annotations.resolve()[annotationId]?.resolve() ?? null
          if (annotation === null) return

          let selectedAnnotation = state.selectedAnnotation
          if (state.selectedAnnotation?.resolve().id === annotationId) {
            selectedAnnotation = null
          }

          const { commit, rollback } = annotations.update({
            [annotationId]: undefined
          })
          const dataStore = useAppStore.getState().store
          freeAnnotationHitIds(annotationId)
          set({
            selectedAnnotation,
            hoveredAnnotationId:
              state.hoveredAnnotationId === annotationId ? null : state.hoveredAnnotationId,
            annotationDirty: true,
            hitTestDirty: true
          })
          const sampleId = state.sample?.resolve().id
          dataStore
            .deleteAnnotations([annotationId])
            .then((c) => {
              if (!c[0]) {
                throw new Error('Failed to delete annotation')
              }
              commit()
            })
            .catch(() => {
              rollback()
              if (sampleId === get().sample?.resolve().id) {
                addAnnotationHitIds(annotationId)
              }
            })
            .finally(() => {
              if (sampleId === get().sample?.resolve().id) {
                set({ annotationDirty: true, hitTestDirty: true })
              }
            })
        }

        /** Optimistically replaces an annotation's points then persists it - shared by move/add/delete-control-point and their undo/redo; resyncs hit ids after. */
        const applyReplacePoints = (annotationId: string, points: IPoint[]) => {
          const state = get()
          const annotation = state.sample?.resolve().annotations.resolve()[annotationId]
          if (annotation === undefined) return

          const sampleId = state.sample?.resolve().id
          const dataStore = useAppStore.getState().store
          const { commit, rollback } = annotation.update({ points })
          set({ annotationDirty: true, hitTestDirty: true })
          dataStore
            .replacePoints(annotationId, points)
            .then((resultPoints) => {
              commit({ points: resultPoints })
            })
            .catch((e) => {
              console.error(e)
              rollback()
            })
            .finally(() => {
              const stillSelected = get().selectedAnnotation
              if (stillSelected?.resolve().id === annotationId) {
                rebuildSelectedAnnotationHitIds(stillSelected.resolve())
              }
              if (sampleId === get().sample?.resolve().id) {
                set({ annotationDirty: true, hitTestDirty: true })
              }
            })
        }

        /** Optimistically relabels an annotation then persists it - also syncs the label picker if it's the selected annotation. */
        const applyRelabel = (annotationId: string, labelId: string) => {
          const state = get()
          const targetAnnotation =
            state.sample?.resolve().annotations.resolve()[annotationId] ?? null
          if (targetAnnotation === null) return

          const { commit, rollback } = targetAnnotation.update({ labelId })
          const dataStore = useAppStore.getState().store
          set({
            annotationDirty: true,
            ...(state.selectedAnnotation?.resolve().id === annotationId
              ? { selectedLabelId: labelId }
              : {})
          })
          const sampleId = state.sample?.resolve().id
          dataStore
            .updateAnnotations([{ id: annotationId, labelId }])
            .then((c) => {
              commit(c[0])
            })
            .catch(() => {
              rollback()
            })
            .finally(() => {
              if (sampleId === get().sample?.resolve().id) {
                set({ annotationDirty: true })
              }
            })
        }

        /** Optimistically swaps an annotation's type+points atomically then persists both via 2 concurrent calls, committed/rolled back together. */
        const applyConvertType = (annotationId: string, type: AnnotationType, points: IPoint[]) => {
          const state = get()
          const annotation = state.sample?.resolve().annotations.resolve()[annotationId]
          if (annotation === undefined) return

          const sampleId = state.sample?.resolve().id
          const dataStore = useAppStore.getState().store
          const { commit, rollback } = annotation.update({ type, points })
          set({ annotationDirty: true, hitTestDirty: true })
          Promise.all([
            dataStore.updateAnnotations([{ id: annotationId, type }]),
            dataStore.replacePoints(annotationId, points)
          ])
            .then(([updateResults, pointResults]) => {
              commit({ type: updateResults[0]?.type, points: pointResults })
            })
            .catch((e) => {
              console.error(e)
              rollback()
            })
            .finally(() => {
              const stillSelected = get().selectedAnnotation
              if (stillSelected?.resolve().id === annotationId) {
                rebuildSelectedAnnotationHitIds(stillSelected.resolve())
              }
              if (sampleId === get().sample?.resolve().id) {
                set({ annotationDirty: true, hitTestDirty: true })
              }
            })
        }

        /** A Box's 2 points become a Polygon's 4 corners, with fresh point ids. */
        const boxPointsToPolygonPoints = (points: IPoint[]): IPoint[] => {
          const [topLeft, bottomRight] = points
          return [
            { id: makeUUID(), x: topLeft.x, y: topLeft.y },
            { id: makeUUID(), x: bottomRight.x, y: topLeft.y },
            { id: makeUUID(), x: bottomRight.x, y: bottomRight.y },
            { id: makeUUID(), x: topLeft.x, y: bottomRight.y }
          ]
        }

        /** A Polygon reduces to its axis-aligned bounding box - necessarily lossy for a non-rectangular outline. */
        const polygonPointsToBoxPoints = (points: IPoint[]): IPoint[] => {
          const box = boundingBoxOf(points)
          return [
            { id: makeUUID(), x: box.minX, y: box.minY },
            { id: makeUUID(), x: box.minX + box.width, y: box.minY + box.height }
          ]
        }

        const DUPLICATE_OFFSET_RATIO = 0.08
        const DUPLICATE_OFFSET_MIN = 12

        /** How far a duplicate is nudged, scaled to its own size so tiny/huge annotations both offset sensibly. */
        const duplicateOffsetFor = (box: BoundingBox): number =>
          Math.max(DUPLICATE_OFFSET_MIN, Math.max(box.width, box.height) * DUPLICATE_OFFSET_RATIO)

        /** Nudges a duplicate's axis by desired, flipping direction or shrinking it to keep the bounding box inside [0, extent]. */
        const clampedDuplicateAxisOffset = (
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

        /** Undoing a just-created annotation before its create call resolves can race the delete - pre-existing risk, not new. */
        const applyHistoryInverse = (entry: HistoryEntry) => {
          switch (entry.kind) {
            case 'create':
              return applyDeleteAnnotation(entry.annotation.id)
            case 'delete':
              return applyCreateAnnotation(entry.annotation)
            case 'points':
              return applyReplacePoints(entry.annotationId, entry.before)
            case 'relabel':
              return applyRelabel(entry.annotationId, entry.beforeLabelId)
            case 'convert':
              return applyConvertType(entry.annotationId, entry.beforeType, entry.beforePoints)
          }
        }

        const applyHistoryForward = (entry: HistoryEntry) => {
          switch (entry.kind) {
            case 'create':
              return applyCreateAnnotation(entry.annotation)
            case 'delete':
              return applyDeleteAnnotation(entry.annotation.id)
            case 'points':
              return applyReplacePoints(entry.annotationId, entry.after)
            case 'relabel':
              return applyRelabel(entry.annotationId, entry.afterLabelId)
            case 'convert':
              return applyConvertType(entry.annotationId, entry.afterType, entry.afterPoints)
          }
        }

        const initialState: LabelerStoreState = {
          imageHitId: imageHitId,
          sizeDirty: false,
          imageDirty: false,
          annotationDirty: false,
          hitTestDirty: false,
          imageRect: { x: 0, y: 0, width: 0, height: 0 },
          bitmap: null,
          canvasSize: [0, 0],
          scale: 1,
          mousePos: [0, 0],
          mode: LabelerMode.Select,
          showHitTestDebugOverlay: false,
          hitTestCanvas: new OffscreenCanvas(0, 0),
          isDragging: false,
          selectedAnnotation: null,
          hitIdToAnnotationId,
          selectedAnnotationControlHitIds,
          selectedAnnotationLineHitIds,
          annotationsPendingDelete: new Set(),
          selectedLabelId: labels[0]?.id ?? '',
          annotationBeingCreated: null,
          labelsMap,
          sample: null,
          moveCurrent: [0, 0],
          pointIdsBeingMoved: null,
          pointIdsBeingMovedAxis: null,
          annotationIdBeingMoved: null,
          isAnnotationsDrawerHovered: false,
          hoveredAnnotationId: null,
          undoStack: [],
          redoStack: []
        }

        return {
          ...initialState,
          canvasToBitmapSpace,
          markAllDirty: () =>
            set({
              sizeDirty: true,
              imageDirty: true,
              annotationDirty: true,
              hitTestDirty: true
            }),
          preDraw: () =>
            set({
              sizeDirty: false,
              imageDirty: false,
              annotationDirty: false,
              hitTestDirty: false
            }),
          onCanvasResize: (width: number, height: number) => {
            set({ canvasSize: [width, height] })
            get().markAllDirty()
            fitBitmapToCanvas()
          },
          onBitmapLoaded: (bitmap: ImageBitmap) => {
            set({ bitmap })
            get().markAllDirty()
            fitBitmapToCanvas()
          },
          onMouseMove: (x: number, y: number) => {
            const state = get()
            const annotationBeingCreated = state.annotationBeingCreated
            let changed = false
            if (state.bitmap !== null && annotationBeingCreated !== null) {
              const xScale = state.bitmap.width / state.imageRect.width
              const yScale = state.bitmap.height / state.imageRect.height
              const point = annotationBeingCreated.points[annotationBeingCreated.points.length - 1]
              const newX = clamp((x - state.imageRect.x) * xScale, 0, state.bitmap.width)
              const newY = clamp((y - state.imageRect.y) * yScale, 0, state.bitmap.height)
              changed = newX !== point.x || newY !== point.y
              point.x = newX
              point.y = newY
            }

            const inCreateMode =
              state.mode === LabelerMode.CreateBox || state.mode === LabelerMode.CreatePolygon
            set({
              mousePos: [x, y],
              annotationBeingCreated: annotationBeingCreated,
              // OR'd, never overwritten to false - only preDraw() clears dirty flags.
              annotationDirty: state.annotationDirty || changed || inCreateMode
            })
          },
          zoom: (x: number, y: number, delta: number) => {
            const state = get()

            let x1 = state.imageRect.x
            let y1 = state.imageRect.y
            let x2 = x1 + state.imageRect.width
            let y2 = y1 + state.imageRect.height
            const scaling = Math.exp(delta)

            x1 = scaling * (x1 - x) + x
            y1 = scaling * (y1 - y) + y
            x2 = scaling * (x2 - x) + x
            y2 = scaling * (y2 - y) + y

            set({
              scale: state.scale * scaling,
              imageRect: {
                x: x1,
                y: y1,
                width: x2 - x1,
                height: y2 - y1
              }
            })

            get().markAllDirty()
          },
          zoomIn: (anchor) => {
            const [anchorX, anchorY] = getZoomAnchor(anchor)
            get().zoom(anchorX, anchorY, ZOOM_STEP_DELTA)
          },
          zoomOut: (anchor) => {
            const [anchorX, anchorY] = getZoomAnchor(anchor)
            get().zoom(anchorX, anchorY, -ZOOM_STEP_DELTA)
          },
          setZoom: (zoom) => {
            const state = get()
            const targetZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
            if (state.scale <= 0 || state.scale === targetZoom) {
              return
            }

            const [centerX, centerY] = getCanvasCenter()
            const delta = Math.log(targetZoom / state.scale)
            get().zoom(centerX, centerY, delta)
          },
          setMode: (mode) => {
            clearSelectedAnnotationHitIds()
            const state = get()

            if (mode === LabelerMode.Select) {
              set({
                mode,
                selectedAnnotation: null,
                annotationDirty: true,
                hitTestDirty: true,
                annotationBeingCreated: null
              })
              return
            }

            const type =
              mode === LabelerMode.CreateBox ? AnnotationType.Box : AnnotationType.Polygon

            set({
              mode,
              selectedAnnotation: null,
              annotationDirty: true,
              hitTestDirty: true,
              annotationBeingCreated: createPendingAnnotation(
                type,
                state.selectedLabelId,
                state.mousePos
              )
            })
          },
          setLabelId: (id) => {
            const { annotationBeingCreated } = get()
            if (annotationBeingCreated !== null) {
              annotationBeingCreated.labelId = id
            }
            set({ selectedLabelId: id, annotationBeingCreated })
          },
          selectAnnotation: (id: string | null) => {
            if ((get().selectedAnnotation?.resolve().id ?? null) === id) return

            let annotation: OptimisticObject<IAnnotation> | null = null
            if (id !== null) {
              annotation = get().sample?.resolve().annotations.resolve()[id] ?? null
            }

            if (annotation !== null) {
              rebuildSelectedAnnotationHitIds(annotation.resolve())
            } else {
              clearSelectedAnnotationHitIds()
            }

            set({
              selectedAnnotation: annotation,
              annotationDirty: true,
              hitTestDirty: true,
              // Selecting an annotation syncs the label picker; deselecting leaves it alone.
              ...(annotation !== null ? { selectedLabelId: annotation.resolve().labelId } : {})
            })
          },
          cancelActiveAction: () => {
            const state = get()
            if (state.selectedAnnotation !== null) {
              state.selectAnnotation(null)
              return
            }

            if (state.mode !== LabelerMode.Select) {
              state.setMode(LabelerMode.Select)
            }
          },
          onConfirmPoint: (x: number, y: number) => {
            const state = get()
            if (state.annotationBeingCreated !== null) {
              if (
                state.annotationBeingCreated.type === AnnotationType.Box &&
                state.annotationBeingCreated.points.length === 2
              ) {
                state.onConfirmAnnotationCreation()
              } else {
                state.annotationBeingCreated.points.push({
                  id: makeUUID(),
                  x: 0,
                  y: 0
                })
                state.onMouseMove(x, y)
              }
            }
          },
          onConfirmAnnotationCreation: (discardLivePoint = false) => {
            const state = get()
            if (state.annotationBeingCreated !== null && state.sample !== null) {
              let annotation: INewAnnotation = state.annotationBeingCreated

              if (annotation.type === AnnotationType.Polygon && discardLivePoint) {
                const committedPoints = annotation.points.slice(0, -1)
                if (committedPoints.length < 3) {
                  return
                }

                annotation = {
                  ...annotation,
                  points: committedPoints
                }
              }

              annotation = normalizeAnnotationPoints(annotation)

              set({
                annotationBeingCreated: createPendingAnnotation(
                  annotation.type,
                  state.selectedLabelId,
                  state.mousePos
                ),
                annotationDirty: true
              })

              applyCreateAnnotation(annotation)
              pushHistory({ kind: 'create', annotation })
            }
          },
          setSample: (sample) => {
            if (activeSampleAbort !== null) {
              activeSampleAbort.abort()
            }

            clearSelectedAnnotationHitIds()

            for (const hitId of hitIdToAnnotationId.keys()) {
              freeHitId(hitId)
            }

            hitIdToAnnotationId.clear()

            for (const annotation of sample.resolve().annotations.values()) {
              addAnnotationHitIds(annotation.resolve().id)
            }

            activeSampleAbort = new AbortController()
            const imageUri = sample.resolve().imageUri

            set({
              sample,
              selectedAnnotation: null,
              hoveredAnnotationId: null,
              hitTestDirty: get().mode === LabelerMode.Select,
              annotationDirty: true,
              undoStack: [],
              redoStack: []
            })

            const sampleId = sample.resolve().id
            loadBitmap(imageUri, activeSampleAbort.signal)
              .then((b) => {
                if (get().sample?.resolve().id === sampleId) {
                  get().onBitmapLoaded(b)
                }
              })
              .catch((e) => {
                if (e instanceof DOMException && e.name === 'Aborted') {
                  return
                }
                throw e
              })
              .finally(() => {
                if (get().sample?.resolve().id === sampleId) {
                  activeSampleAbort = null
                }
              })
          },
          cancelPendingSampleLoad: () => {
            activeSampleAbort?.abort()
          },
          setAnnotationLabelId: (annotationId, labelId) => {
            const state = get()
            const targetAnnotation =
              state.sample?.resolve().annotations.resolve()[annotationId] ?? null
            if (targetAnnotation === null) {
              return
            }

            const beforeLabelId = targetAnnotation.resolve().labelId
            if (beforeLabelId === labelId) return

            applyRelabel(annotationId, labelId)
            pushHistory({ kind: 'relabel', annotationId, beforeLabelId, afterLabelId: labelId })
          },
          moveSelectedAnnotationBy: (dx, dy) => {
            const state = get()
            if (state.selectedAnnotation === null) {
              return
            }

            set({
              moveCurrent: [dx, dy],
              pointIdsBeingMoved: state.selectedAnnotation.resolve().points.map((c) => c.id),
              pointIdsBeingMovedAxis: null,
              annotationIdBeingMoved: state.selectedAnnotation.resolve().id,
              annotationDirty: true,
              hitTestDirty: true
            })
          },
          moveAnnotationPoint: (pointId, x, y) => {
            const state = get()
            if (state.selectedAnnotation === null) return

            const localPos = canvasToBitmapSpace(x, y)

            if (
              pointId === BOX_CORNER_HANDLE_TOP_RIGHT ||
              pointId === BOX_CORNER_HANDLE_BOTTOM_LEFT
            ) {
              const boxPoints = state.selectedAnnotation.resolve().points
              if (boxPoints.length !== 2) return
              // Normalized: points[0] is top-left, points[1] is bottom-right.
              const [topLeft, bottomRight] = boxPoints
              const isTopRight = pointId === BOX_CORNER_HANDLE_TOP_RIGHT
              // Top-right takes the right edge's x and top edge's y; bottom-left is the mirror.
              const xSource = isTopRight ? bottomRight : topLeft
              const ySource = isTopRight ? topLeft : bottomRight

              set({
                moveCurrent: [localPos[0] - xSource.x, localPos[1] - ySource.y],
                pointIdsBeingMoved: [xSource.id, ySource.id],
                pointIdsBeingMovedAxis: ['x', 'y'],
                annotationIdBeingMoved: state.selectedAnnotation.resolve().id,
                annotationDirty: true,
                hitTestDirty: true
              })
              return
            }

            if (
              pointId === BOX_EDGE_TOP ||
              pointId === BOX_EDGE_RIGHT ||
              pointId === BOX_EDGE_BOTTOM ||
              pointId === BOX_EDGE_LEFT
            ) {
              const boxPoints = state.selectedAnnotation.resolve().points
              if (boxPoints.length !== 2) return
              // Normalized: points[0] is top-left, points[1] is bottom-right.
              const [topLeft, bottomRight] = boxPoints
              const isTopOrLeft = pointId === BOX_EDGE_TOP || pointId === BOX_EDGE_LEFT
              const source = isTopOrLeft ? topLeft : bottomRight
              const axis: 'x' | 'y' =
                pointId === BOX_EDGE_TOP || pointId === BOX_EDGE_BOTTOM ? 'y' : 'x'

              set({
                moveCurrent: [localPos[0] - source.x, localPos[1] - source.y],
                pointIdsBeingMoved: [source.id],
                pointIdsBeingMovedAxis: [axis],
                annotationIdBeingMoved: state.selectedAnnotation.resolve().id,
                annotationDirty: true,
                hitTestDirty: true
              })
              return
            }

            const point = state.selectedAnnotation.resolve().points.find((c) => c.id === pointId)
            if (point === undefined) return

            set({
              moveCurrent: [localPos[0] - point.x, localPos[1] - point.y],
              pointIdsBeingMoved: [pointId],
              pointIdsBeingMovedAxis: null,
              annotationIdBeingMoved: state.selectedAnnotation.resolve().id,
              annotationDirty: true,
              hitTestDirty: true
            })
          },
          setShowHitTestDebugOverlay: (enabled) => {
            set({ showHitTestDebugOverlay: enabled, annotationDirty: true })
          },
          commitAnnotationMove: (annotationId) => {
            const state = get()
            const sample = state.sample?.resolve()
            if (sample === undefined) return

            const annotation = sample.annotations.resolve()[annotationId]
            const sampleId = sample.id

            if (annotation === undefined || sampleId === undefined) {
              return
            }

            const resolvedAnnotation = annotation.resolve()
            const before = structuredClone(resolvedAnnotation.points)
            const pointsBeingMoved = new Set(state.pointIdsBeingMoved)
            const annotationPointIds = new Set(resolvedAnnotation.points.map((c) => c.id))
            const pointsToMove = pointsBeingMoved.intersection(annotationPointIds)

            if (pointsToMove.size === 0) return

            const payload = normalizeAnnotationPoints({
              type: resolvedAnnotation.type,
              points: resolvedAnnotation.points.map((point) => {
                const [dx, dy] = axisMaskedMoveDelta(
                  point.id,
                  state.pointIdsBeingMoved,
                  state.pointIdsBeingMovedAxis,
                  state.moveCurrent
                )
                return {
                  id: point.id,
                  x: point.x + dx,
                  y: point.y + dy
                }
              })
            }).points

            set({
              annotationDirty: true,
              hitTestDirty: true,
              annotationIdBeingMoved: null,
              pointIdsBeingMoved: null,
              pointIdsBeingMovedAxis: null
            })

            applyReplacePoints(annotationId, payload)
            pushHistory({ kind: 'points', annotationId, before, after: payload })
          },
          deleteAnnotation: (annotationId: string) => {
            const state = get()
            const annotation =
              state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
            if (annotation === null) return

            applyDeleteAnnotation(annotationId)
            pushHistory({ kind: 'delete', annotation })
          },
          deleteSelectedAnnotation: () => {
            const state = get()
            if (state.selectedAnnotation !== null) {
              const annotation = state.selectedAnnotation
              state.deleteAnnotation(annotation.resolve().id)
            }
          },
          duplicateAnnotation: (annotationId: string) => {
            const state = get()
            const annotation =
              state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
            if (annotation === null) return undefined

            const box = boundingBoxOf(annotation.points)
            const desired = duplicateOffsetFor(box)
            const bitmap = state.bitmap
            const dx =
              bitmap !== null
                ? clampedDuplicateAxisOffset(box.minX, box.width, bitmap.width, desired)
                : desired
            const dy =
              bitmap !== null
                ? clampedDuplicateAxisOffset(box.minY, box.height, bitmap.height, desired)
                : desired

            const duplicate: IAnnotation = {
              id: makeUUID(),
              type: annotation.type,
              labelId: annotation.labelId,
              points: annotation.points.map((p) => ({
                id: makeUUID(),
                x: p.x + dx,
                y: p.y + dy
              }))
            }

            applyCreateAnnotation(duplicate)
            pushHistory({ kind: 'create', annotation: duplicate })
            get().selectAnnotation(duplicate.id)
            return duplicate.id
          },
          duplicateSelectedAnnotation: () => {
            const state = get()
            if (state.selectedAnnotation !== null) {
              state.duplicateAnnotation(state.selectedAnnotation.resolve().id)
            }
          },
          convertAnnotationType: (annotationId: string) => {
            const state = get()
            const annotation =
              state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
            if (annotation === null) return

            const afterType =
              annotation.type === AnnotationType.Box ? AnnotationType.Polygon : AnnotationType.Box
            const afterPoints =
              afterType === AnnotationType.Polygon
                ? boxPointsToPolygonPoints(annotation.points)
                : polygonPointsToBoxPoints(annotation.points)

            applyConvertType(annotationId, afterType, afterPoints)
            pushHistory({
              kind: 'convert',
              annotationId,
              beforeType: annotation.type,
              beforePoints: structuredClone(annotation.points),
              afterType,
              afterPoints
            })
          },
          addControlPoint: (controlPointId: string, x: number, y: number) => {
            const state = get()
            const annotation = state.selectedAnnotation ?? null
            if (annotation === null) return undefined
            const pointIndex = annotation.resolve().points.findIndex((c) => c.id === controlPointId)
            if (pointIndex === -1) return undefined

            const [bitmapX, bitmapY] = canvasToBitmapSpace(x, y)

            const newPoint: IPoint = {
              id: makeUUID(),
              x: bitmapX,
              y: bitmapY
            }
            const resolvedAnnotation = structuredClone(annotation.resolve())
            const before = structuredClone(resolvedAnnotation.points)
            const points = resolvedAnnotation.points
            points.splice(pointIndex + 1, 0, newPoint)
            addSelectedAnnotationPointId(newPoint.id)
            set({ annotationDirty: true, hitTestDirty: true })
            applyReplacePoints(resolvedAnnotation.id, points)
            pushHistory({
              kind: 'points',
              annotationId: resolvedAnnotation.id,
              before,
              after: points
            })
            return newPoint.id
          },
          deleteControlPoint: (controlPointId: string) => {
            const state = get()
            const annotation = state.selectedAnnotation ?? null
            if (annotation === null) return
            const resolvedAnnotation = structuredClone(annotation.resolve())
            const pointIndex = resolvedAnnotation.points.findIndex((c) => c.id === controlPointId)
            if (pointIndex === -1 || resolvedAnnotation.points.length <= 3) return
            const before = structuredClone(resolvedAnnotation.points)
            const points = resolvedAnnotation.points
            const pointToRemove = points[pointIndex]
            points.splice(pointIndex, 1)
            clearSelectedAnnotationPointId(pointToRemove.id)
            set({ annotationDirty: true, hitTestDirty: true })
            applyReplacePoints(resolvedAnnotation.id, points)
            pushHistory({
              kind: 'points',
              annotationId: resolvedAnnotation.id,
              before,
              after: points
            })
          },
          hittest: (x, y): HitTestResult | null => {
            const state = get()

            const imageData = state.hitTestCanvas
              .getContext('2d', { willReadFrequently: true })
              ?.getImageData(Math.floor(x), Math.floor(y), 1, 1)

            if (imageData !== undefined) {
              const asHex = rgb2hex({
                r: imageData.data[0],
                g: imageData.data[1],
                b: imageData.data[2]
              })

              let hitAnnotationId = state.hitIdToAnnotationId.get(asHex) ?? null
              const controlPointId: string | null =
                state.selectedAnnotationControlHitIds.get(asHex) ?? null
              const lineControlPointId: string | null =
                state.selectedAnnotationLineHitIds.get(asHex) ?? null

              if (
                (hitAnnotationId ?? controlPointId ?? lineControlPointId) !== null &&
                state.selectedAnnotation?.resolve()?.id !== undefined
              ) {
                hitAnnotationId = hitAnnotationId ?? state.selectedAnnotation.resolve().id

                return {
                  annotationId: hitAnnotationId,
                  controlPointId: controlPointId,
                  lineControlPointId: lineControlPointId
                }
              } else if (hitAnnotationId !== null) {
                return {
                  annotationId: hitAnnotationId,
                  controlPointId: null,
                  lineControlPointId: null
                }
              }
            }

            return null
          },
          setHoveredAnnotation: (id) => {
            if (get().hoveredAnnotationId === id) return
            set({ hoveredAnnotationId: id, annotationDirty: true })
          },
          setAnnotationsDrawerHovered: (hovered) => {
            const state = get()
            if (state.isAnnotationsDrawerHovered === hovered) return
            set({
              isAnnotationsDrawerHovered: hovered,
              // Belt-and-suspenders alongside each row's own onMouseLeave.
              hoveredAnnotationId: hovered ? state.hoveredAnnotationId : null,
              annotationDirty: true
            })
          },
          undo: () => {
            const { undoStack } = get()
            const entry = undoStack[undoStack.length - 1]
            if (entry === undefined) return

            set({ undoStack: undoStack.slice(0, -1) })
            applyHistoryInverse(entry)
            set((s) => ({ redoStack: [...s.redoStack, entry] }))
          },
          redo: () => {
            const { redoStack } = get()
            const entry = redoStack[redoStack.length - 1]
            if (entry === undefined) return

            set({ redoStack: redoStack.slice(0, -1) })
            applyHistoryForward(entry)
            set((s) => ({ undoStack: [...s.undoStack, entry] }))
          }
        }
      }),
    [labels]
  )

  return { store }
}
