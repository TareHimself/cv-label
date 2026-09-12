import { LabelerMode } from '@renderer/types'
import { rgb2hex } from '@shared/color'
import { AnnotationType, IAnnotation, ILabel, INewAnnotation, IPoint } from '@shared/types'
import { create } from 'zustand'
import { useMemo } from 'react'
import { makeUUID } from '@shared/utils'
import { clamp } from '@mantine/hooks'
import { boundingBoxOf } from '@renderer/util/boundingBox'
import {
  BOX_CORNER_HANDLE_TOP_RIGHT,
  BOX_CORNER_HANDLE_BOTTOM_LEFT,
  BOX_EDGE_TOP,
  BOX_EDGE_RIGHT,
  BOX_EDGE_BOTTOM,
  BOX_EDGE_LEFT,
  HitIdTracker
} from './labeler/hitIds'
import {
  normalizeAnnotationPoints,
  axisMaskedMoveDelta,
  isValidBoxCreation,
  boxPointsToPolygonPoints,
  polygonPointsToBoxPoints,
  duplicateOffsetFor,
  clampedDuplicateAxisOffset
} from './labeler/geometry'
import { createHistoryController } from './labeler/history'
import { idsEqual, resolveSelectedAnnotation } from './labeler/selection'
import type { Vector2, LabelerStoreState, LabelerStore, HistoryEntry } from './labeler/storeTypes'

export {
  BOX_CORNER_HANDLE_TOP_RIGHT,
  BOX_CORNER_HANDLE_BOTTOM_LEFT,
  BOX_EDGE_TOP,
  BOX_EDGE_RIGHT,
  BOX_EDGE_BOTTOM,
  BOX_EDGE_LEFT
} from './labeler/hitIds'
export { normalizeAnnotationPoints, axisMaskedMoveDelta } from './labeler/geometry'
export type { HitTestResult, HistoryEntry, LabelerStore } from './labeler/storeTypes'

const ZOOM_STEP_DELTA = 0.15
const MIN_ZOOM = 0.05
const MAX_ZOOM = 32

const createLabelsMap = (labels: ILabel[]) => {
  const labelsMap: Record<string, ILabel> = {}
  for (const label of labels) {
    labelsMap[label.id] = label
  }

  return labelsMap
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

export const useLabeler = (labels: ILabel[]) => {
  const store = useMemo(
    () =>
      create<LabelerStore>((set, get) => {
        const hitIds = new HitIdTracker()
        let activeSampleAbort: AbortController | null = null
        /** Raw (pre-clamp) canvas position of the in-progress box's first corner - see isValidBoxCreation. */
        let annotationCreationRawStart: Vector2 | null = null
        const imageHitId = hitIds.colorGenerator.make()
        const labelsMap = createLabelsMap(labels)

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

        /** Shared by duplicateAnnotation and the batch path in duplicateSelectedAnnotation. */
        const buildDuplicate = (
          annotation: IAnnotation,
          bitmap: ImageBitmap | null
        ): IAnnotation => {
          const box = boundingBoxOf(annotation.points)
          const desired = duplicateOffsetFor(box)
          const dx =
            bitmap !== null
              ? clampedDuplicateAxisOffset(box.minX, box.width, bitmap.width, desired)
              : desired
          const dy =
            bitmap !== null
              ? clampedDuplicateAxisOffset(box.minY, box.height, bitmap.height, desired)
              : desired

          return {
            id: makeUUID(),
            type: annotation.type,
            labelId: annotation.labelId,
            points: annotation.points.map((p) => ({
              id: makeUUID(),
              x: p.x + dx,
              y: p.y + dy
            }))
          }
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

        const history = createHistoryController({ get, set, hitIds })

        /** Shared by selectAnnotation/toggleAnnotationSelection/setSelectedAnnotationIds - keeps selectedAnnotation and hit ids in sync with the set. */
        const applySelection = (ids: Set<string>) => {
          const state = get()
          if (idsEqual(state.selectedAnnotationIds, ids)) return

          const selectedAnnotation = resolveSelectedAnnotation(ids, state.sample)

          if (selectedAnnotation !== null) {
            hitIds.rebuildSelectedAnnotationHitIds(selectedAnnotation.resolve())
          } else {
            hitIds.clearSelectedAnnotationHitIds()
          }

          set({
            selectedAnnotationIds: ids,
            selectedAnnotation,
            annotationDirty: true,
            hitTestDirty: true,
            // Selecting a single annotation syncs the label picker; any other case leaves it alone.
            ...(selectedAnnotation !== null
              ? { selectedLabelId: selectedAnnotation.resolve().labelId }
              : {})
          })
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
          selectedAnnotationIds: new Set(),
          selectedAnnotation: null,
          groupMoveAnnotationIds: null,
          hitIdToAnnotationId: hitIds.hitIdToAnnotationId,
          selectedAnnotationControlHitIds: hitIds.selectedAnnotationControlHitIds,
          selectedAnnotationLineHitIds: hitIds.selectedAnnotationLineHitIds,
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
            hitIds.clearSelectedAnnotationHitIds()
            const state = get()

            if (mode === LabelerMode.Select) {
              set({
                mode,
                selectedAnnotationIds: new Set(),
                selectedAnnotation: null,
                groupMoveAnnotationIds: null,
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
              selectedAnnotationIds: new Set(),
              selectedAnnotation: null,
              groupMoveAnnotationIds: null,
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
            applySelection(id === null ? new Set() : new Set([id]))
          },
          toggleAnnotationSelection: (id: string) => {
            const next = new Set(get().selectedAnnotationIds)
            if (next.has(id)) {
              next.delete(id)
            } else {
              next.add(id)
            }
            applySelection(next)
          },
          setSelectedAnnotationIds: (ids: string[]) => {
            applySelection(new Set(ids))
          },
          cancelActiveAction: () => {
            const state = get()
            if (state.selectedAnnotationIds.size > 0) {
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
                if (state.annotationBeingCreated.type === AnnotationType.Box) {
                  // The box's start corner, locked in at the actual click - see isValidBoxCreation.
                  annotationCreationRawStart = [x, y]
                }
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
              const shouldDiscard =
                annotation.type === AnnotationType.Box &&
                !isValidBoxCreation(
                  annotationCreationRawStart,
                  state.mousePos,
                  state.imageRect,
                  state.scale,
                  annotation
                )

              set({
                annotationBeingCreated: createPendingAnnotation(
                  annotation.type,
                  state.selectedLabelId,
                  state.mousePos
                ),
                annotationDirty: true
              })

              if (shouldDiscard) return

              history.applyCreateAnnotation(annotation)
              history.pushHistory({ kind: 'create', annotation })
            }
          },
          setSample: (sample) => {
            if (activeSampleAbort !== null) {
              activeSampleAbort.abort()
            }

            hitIds.clearSelectedAnnotationHitIds()

            for (const hitId of hitIds.hitIdToAnnotationId.keys()) {
              hitIds.freeHitId(hitId)
            }

            hitIds.hitIdToAnnotationId.clear()

            for (const annotation of sample.resolve().annotations.values()) {
              hitIds.addAnnotationHitIds(annotation.resolve().id)
            }

            activeSampleAbort = new AbortController()
            const imageUri = sample.resolve().imageUri

            set({
              sample,
              selectedAnnotationIds: new Set(),
              selectedAnnotation: null,
              groupMoveAnnotationIds: null,
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

            history.applyRelabel(annotationId, labelId)
            history.pushHistory({
              kind: 'relabel',
              annotationId,
              beforeLabelId,
              afterLabelId: labelId
            })
          },
          setSelectedAnnotationsLabelId: (labelId: string) => {
            const state = get()
            const ids = [...state.selectedAnnotationIds]
            const entries: HistoryEntry[] = []
            for (const annotationId of ids) {
              const targetAnnotation = state.sample?.resolve().annotations.resolve()[annotationId]
              if (targetAnnotation === undefined) continue
              const beforeLabelId = targetAnnotation.resolve().labelId
              if (beforeLabelId === labelId) continue

              history.applyRelabel(annotationId, labelId)
              entries.push({ kind: 'relabel', annotationId, beforeLabelId, afterLabelId: labelId })
            }
            if (entries.length === 0) return
            history.pushHistory(entries.length === 1 ? entries[0] : { kind: 'batch', entries })
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
          moveSelectedAnnotationsBy: (dx, dy) => {
            const state = get()
            if (state.selectedAnnotationIds.size === 0) return

            set({
              moveCurrent: [dx, dy],
              groupMoveAnnotationIds: [...state.selectedAnnotationIds],
              annotationDirty: true,
              hitTestDirty: true
            })
          },
          commitGroupAnnotationMove: () => {
            const state = get()
            const ids = state.groupMoveAnnotationIds
            if (ids === null) return

            const [dx, dy] = state.moveCurrent
            set({ groupMoveAnnotationIds: null, moveCurrent: [0, 0] })

            if (dx === 0 && dy === 0) return

            const entries: HistoryEntry[] = []
            for (const annotationId of ids) {
              const annotation = state.sample?.resolve().annotations.resolve()[annotationId]
              if (annotation === undefined) continue

              const before = structuredClone(annotation.resolve().points)
              const after = before.map((p) => ({ id: p.id, x: p.x + dx, y: p.y + dy }))

              history.applyReplacePoints(annotationId, after)
              entries.push({ kind: 'points', annotationId, before, after })
            }
            if (entries.length === 0) return
            history.pushHistory(entries.length === 1 ? entries[0] : { kind: 'batch', entries })
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

            history.applyReplacePoints(annotationId, payload)
            history.pushHistory({ kind: 'points', annotationId, before, after: payload })
          },
          deleteAnnotation: (annotationId: string) => {
            const state = get()
            const annotation =
              state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
            if (annotation === null) return

            history.applyDeleteAnnotation(annotationId)
            history.pushHistory({ kind: 'delete', annotation })
          },
          deleteSelectedAnnotation: () => {
            const state = get()
            const ids = [...state.selectedAnnotationIds]
            if (ids.length === 0) return
            if (ids.length === 1) {
              state.deleteAnnotation(ids[0])
              return
            }

            const entries: HistoryEntry[] = []
            for (const annotationId of ids) {
              const annotation =
                state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
              if (annotation === null) continue
              history.applyDeleteAnnotation(annotationId)
              entries.push({ kind: 'delete', annotation })
            }
            if (entries.length > 0) history.pushHistory({ kind: 'batch', entries })
          },
          duplicateAnnotation: (annotationId: string) => {
            const state = get()
            const annotation =
              state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
            if (annotation === null) return undefined

            const duplicate = buildDuplicate(annotation, state.bitmap)
            history.applyCreateAnnotation(duplicate)
            history.pushHistory({ kind: 'create', annotation: duplicate })
            get().selectAnnotation(duplicate.id)
            return duplicate.id
          },
          duplicateSelectedAnnotation: () => {
            const state = get()
            const ids = [...state.selectedAnnotationIds]
            if (ids.length === 0) return
            if (ids.length === 1) {
              state.duplicateAnnotation(ids[0])
              return
            }

            const entries: HistoryEntry[] = []
            const duplicateIds: string[] = []
            for (const annotationId of ids) {
              const annotation =
                state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
              if (annotation === null) continue
              const duplicate = buildDuplicate(annotation, state.bitmap)
              history.applyCreateAnnotation(duplicate)
              entries.push({ kind: 'create', annotation: duplicate })
              duplicateIds.push(duplicate.id)
            }
            if (entries.length === 0) return
            history.pushHistory({ kind: 'batch', entries })
            get().setSelectedAnnotationIds(duplicateIds)
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

            history.applyConvertType(annotationId, afterType, afterPoints)
            history.pushHistory({
              kind: 'convert',
              annotationId,
              beforeType: annotation.type,
              beforePoints: structuredClone(annotation.points),
              afterType,
              afterPoints
            })
          },
          convertSelectedAnnotationsType: (targetType: AnnotationType) => {
            const state = get()
            const entries: HistoryEntry[] = []
            for (const annotationId of state.selectedAnnotationIds) {
              const annotation =
                state.sample?.resolve().annotations.resolve()[annotationId]?.resolve() ?? null
              if (annotation === null || annotation.type === targetType) continue

              const afterPoints =
                targetType === AnnotationType.Polygon
                  ? boxPointsToPolygonPoints(annotation.points)
                  : polygonPointsToBoxPoints(annotation.points)

              history.applyConvertType(annotationId, targetType, afterPoints)
              entries.push({
                kind: 'convert',
                annotationId,
                beforeType: annotation.type,
                beforePoints: structuredClone(annotation.points),
                afterType: targetType,
                afterPoints
              })
            }
            if (entries.length === 0) return
            history.pushHistory(entries.length === 1 ? entries[0] : { kind: 'batch', entries })
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
            hitIds.addSelectedAnnotationPointId(newPoint.id)
            set({ annotationDirty: true, hitTestDirty: true })
            history.applyReplacePoints(resolvedAnnotation.id, points)
            history.pushHistory({
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
            hitIds.clearSelectedAnnotationPointId(pointToRemove.id)
            set({ annotationDirty: true, hitTestDirty: true })
            history.applyReplacePoints(resolvedAnnotation.id, points)
            history.pushHistory({
              kind: 'points',
              annotationId: resolvedAnnotation.id,
              before,
              after: points
            })
          },
          hittest: (x, y) => {
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
          undo: history.undo,
          redo: history.redo
        }
      }),
    [labels]
  )

  return { store }
}
