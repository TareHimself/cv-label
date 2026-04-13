import { IOptimisticSample, LabelerMode } from '@renderer/types'
import { randomHexColor, rgb2hex } from '@shared/color'
import { AnnotationType, IAnnotation, ILabel, INewAnnotation } from '@shared/types'
import { create } from 'zustand'
import { useMemo } from 'react'
import { makeUUID } from '@shared/utils'
import { clamp } from '@mantine/hooks'
import { useAppStore } from './useAppStore'
import { OptimisticObject } from '@renderer/optimistic'

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
  /**
   * General purpose xy diff applied contextually to some item
   */
  moveInitial: Vector2
  moveCurrent: Vector2
  pointIdsBeingMoved: string[] | null
  annotationIdBeingMoved: string | null
  // readonly annotations: Map<string, OptimisticObject<IAnnotation>>
  mode: LabelerMode
  showHitTestDebugOverlay: boolean

  sample: IOptimisticSample | null

  readonly annotationsPendingDelete: Set<string>
  readonly activeHitIds: Set<string>
  readonly availableHitIds: Set<string>
  readonly hitTestCanvas: OffscreenCanvas

  isDragging: boolean
  selectedAnnotation: OptimisticObject<IAnnotation> | null
  readonly hitIdToAnnotationId: OneToOneMap<string, string>
  readonly selectedAnnotationControlHitIds: OneToOneMap<string, string>
  readonly selectedAnnotationLineHitIds: OneToOneMap<string, string>
  selectedLabelId: string
  annotationBeingCreated: INewAnnotation | null
  readonly labelsMap: Record<string, ILabel>
  // hitHandlers: Map<string,(e: unknown) => void>
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

type LabelerStoreActions = {
  markAllDirty: () => void
  preDraw: () => void
  onCanvasResize: (width: number, height: number) => void
  setSample: (sample: IOptimisticSample) => void
  onBitmapLoaded: (bitmap: ImageBitmap) => void
  //onMouseOver: (x: number, y: number) => void
  zoom: (x: number, y: number, delta: number) => void
  zoomIn: (anchor?: 'center' | 'mouse') => void
  zoomOut: (anchor?: 'center' | 'mouse') => void
  setZoom: (zoom: number) => void
  //setAnnotations: (annotations: IAnnotation[]) => void
  setMode: (mode: LabelerMode) => void
  setLabelId: (labelId: string) => void
  selectAnnotation: (id: string | null) => void
  onMouseMove: (x: number, y: number) => void
  onConfirmPoint: (x: number, y: number) => void
  onConfirmAnnotationCreation: (discardLivePoint?: boolean) => void
  setSelectedAnnotationLabelId: (newLabelId: string) => void
  moveSelectedAnnotationBy: (dx: number, dy: number) => void
  moveAnnotationPoint: (pointId: string, x: number, y: number) => void
  commitAnnotationMove: (annotationId: string) => void
  setShowHitTestDebugOverlay: (enabled: boolean) => void
  canvasToBitmapSpace: (x: number, y: number) => [x: number, y: number]
  deleteAnnotation: (annotationId: string) => void
  deleteSelectedAnnotation: () => void
  hittest: (x: number, y: number) => HitTestResult | null
}

export type LabelerStore = LabelerStoreState & LabelerStoreActions

export const useLabeler = (labels: ILabel[]) => {
  const store = useMemo(
    () =>
      create<LabelerStore>((set, get) => {
        let activeSampleAbort: AbortController | null = null
        const imageHitId = randomHexColor()
        const labelsMap = createLabelsMap(labels)
        const activeHitIds = new Set([imageHitId])
        const availableHitIds = new Set<string>()
        const hitIdToAnnotationId = new OneToOneMap<string, string>()
        const selectedAnnotationControlHitIds = new OneToOneMap<string, string>()
        const selectedAnnotationLineHitIds = new OneToOneMap<string, string>()

        const makeHitId = () => {
          const pooledId = availableHitIds.values().next().value
          if (pooledId !== undefined) {
            availableHitIds.delete(pooledId)
            activeHitIds.add(pooledId)
            return pooledId
          }

          let color = randomHexColor()
          while (activeHitIds.has(color)) {
            color = randomHexColor()
          }

          activeHitIds.add(color)
          return color
        }

        const freeHitId = (id: string) => {
          activeHitIds.delete(id)
          availableHitIds.add(id)
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

        // const applyPointSnapshot = (annotation: IAnnotation, points: IPoint[]) => {
        //   const pointMap = new Map(points.map((p) => [p.id, p]))
        //   for (const point of annotation.points) {
        //     const replacement = pointMap.get(point.id)
        //     if (replacement !== undefined) {
        //       point.x = replacement.x
        //       point.y = replacement.y
        //     }
        //   }
        // }

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

        // const startAnnotationAdd = (annotation: IAnnotation) => {
        //   const { annotations } = get()
        //   annotations.set(annotation.id, new OptimisticObject(annotation))
        //   const hitId = makeHitId()
        //   hitIdToAnnotationId.set(hitId, annotation.id)

        //   set({
        //     annotationDirty: true
        //   })
        // }

        // const commitAnnotationAdd = (annotation: IAnnotation) => {
        //   const { annotations } = get()
        //   annotations.set(annotation.id, new OptimisticObject(annotation))
        //   const hitId = makeHitId()
        //   hitIdToAnnotationId.set(hitId, annotation.id)

        //   set({
        //     annotationDirty: true
        //   })
        // }

        // const startAnnotationRemove = (annotationId: string) => {

        //   const { annotations } = get()
        //   annotations.set(annotation.id, new OptimisticObject(annotation))
        //   const hitId = makeHitId()
        //   hitIdToAnnotationId.set(hitId, annotation.id)

        //   set({
        //     annotationDirty: true
        //   })
        // }

        // const commitAnnotationRemove = (annotationId: string) => {

        //   const { annotations } = get()
        //   annotations.set(annotation.id, new OptimisticObject(annotation))
        //   const hitId = makeHitId()
        //   hitIdToAnnotationId.set(hitId, annotation.id)

        //   set({
        //     annotationDirty: true
        //   })
        // }

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
          moveInitial: [0, 0],
          //annotations: new Map(),
          mode: LabelerMode.Select,
          showHitTestDebugOverlay: false,
          activeHitIds,
          availableHitIds,
          hitTestCanvas: new OffscreenCanvas(0, 0),
          isDragging: false,
          selectedAnnotation: null,
          hitIdToAnnotationId,
          selectedAnnotationControlHitIds,
          selectedAnnotationLineHitIds,
          annotationsPendingDelete: new Set(),
          //annotationsPendingAdd: new Set(),
          selectedLabelId: labels[0]?.id ?? '',
          annotationBeingCreated: null,
          labelsMap,
          sample: null,
          moveCurrent: [0, 0],
          pointIdsBeingMoved: null,
          annotationIdBeingMoved: null
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
              state.mode === LabelerMode.CreateBox || state.mode === LabelerMode.CreateMask
            set({
              mousePos: [x, y],
              annotationBeingCreated: annotationBeingCreated,
              annotationDirty: changed || inCreateMode
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
          // setAnnotations: (newAnnotations: IAnnotation[]) => {
          //   const { annotations, annotationsPendingDelete } = get()
          //   const newIds = new Set(newAnnotations.map((c) => c.id))
          //   const intersection = annotationsPendingDelete.intersection(newIds)
          //   annotations.clear()
          //   annotationsPendingDelete.clear()
          //   clearSelectedAnnotationHitIds()

          //   for (const hitId of hitIdToAnnotationId.keys()) {
          //     freeHitId(hitId)
          //   }

          //   hitIdToAnnotationId.clear()

          //   for (const id of intersection) {
          //     intersection.add(id)
          //   }

          //   for (const annotation of newAnnotations) {
          //     annotations.set(annotation.id, new OptimisticObject(annotation))
          //     const hitId = makeHitId()
          //     hitIdToAnnotationId.set(hitId, annotation.id)
          //   }

          //   set({
          //     selectedAnnotation: null,
          //     hitTestDirty: get().mode === LabelerMode.Select,
          //     annotationDirty: true
          //   })
          // },
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

            const type = mode === LabelerMode.CreateBox ? AnnotationType.Box : AnnotationType.Mask

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

            clearSelectedAnnotationHitIds()
            let annotation: OptimisticObject<IAnnotation> | null = null
            if (id !== null) {
              annotation = get().sample?.resolve().annotations.resolve()[id] ?? null
              if (annotation !== null) {
                for (const point of annotation.resolve().points) {
                  selectedAnnotationControlHitIds.set(makeHitId(), point.id)
                }

                if (annotation.resolve().type === AnnotationType.Mask) {
                  for (const point of annotation.resolve().points) {
                    selectedAnnotationLineHitIds.set(makeHitId(), point.id)
                  }
                }
              }
            }

            set({ selectedAnnotation: annotation, annotationDirty: true, hitTestDirty: true })
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
              const dataStore = useAppStore.getState().store
              let annotation: INewAnnotation = state.annotationBeingCreated

              if (annotation.type === AnnotationType.Mask && discardLivePoint) {
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

              const annotations = state.sample.resolve().annotations
              const newAnnotation = new OptimisticObject(annotation)
              const updateId = annotations.update({
                [annotation.id]: newAnnotation
              })

              const sampleId = state.sample.resolve().id
              dataStore
                .createAnnotations(sampleId, [annotation])
                .then((results) => {
                  newAnnotation.updateBase(results[0])
                  annotations.commit(updateId)
                  if (sampleId === get().sample?.resolve().id) {
                    addAnnotationHitIds(results[0].id)
                    set({ annotationDirty: true, hitTestDirty: true })
                  }
                })
                .catch(() => {
                  annotations.rollback(updateId)
                  if (sampleId === get().sample?.resolve().id) {
                    set({ annotationDirty: true })
                  }
                })
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
              hitTestDirty: get().mode === LabelerMode.Select,
              annotationDirty: true
            })

            const sampleId = sample.resolve().id
            loadBitmap(imageUri, activeSampleAbort.signal)
              .then((b) => {
                if (get().sample?.resolve().id === sampleId) {
                  get().onBitmapLoaded(b)
                }
              })
              .finally(() => {
                if (get().sample?.resolve().id === sampleId) {
                  activeSampleAbort = null
                }
              })
          },
          setSelectedAnnotationLabelId: (labelId) => {
            const state = get()
            if (state.selectedAnnotation === null) {
              return
            }
            const selectedAnnotation = state.selectedAnnotation
            const updateId = selectedAnnotation.update({ labelId: labelId })
            const dataStore = useAppStore.getState().store
            set({ annotationDirty: true })
            const sampleId = state.sample?.resolve().id
            dataStore
              .updateAnnotations([
                {
                  id: selectedAnnotation.resolve().id,
                  labelId: labelId
                }
              ])
              .then((c) => {
                selectedAnnotation.commit(updateId)
                selectedAnnotation.updateBase(c[0])
              })
              .catch(() => {
                selectedAnnotation.rollback(updateId)
              })
              .finally(() => {
                if (sampleId === get().sample?.resolve().id) {
                  set({ annotationDirty: true })
                }
              })
          },
          moveSelectedAnnotationBy: (dx, dy) => {
            const state = get()
            if (state.selectedAnnotation === null) {
              return
            }

            set({
              moveCurrent: [dx, dy],
              pointIdsBeingMoved: state.selectedAnnotation.resolve().points.map((c) => c.id),
              annotationIdBeingMoved: state.selectedAnnotation.resolve().id,
              annotationDirty: true,
              hitTestDirty: true
            })

            // state.selectedAnnotation.get().points.forEach((point, idx) => {
            //   const initialPoint = initialPoints[idx]
            //   if (initialPoint !== undefined) {
            //     point.x = initialPoint.x + dx
            //     point.y = initialPoint.y + dy
            //   }
            // })
          },
          moveAnnotationPoint: (pointId, x, y) => {
            const state = get()
            if (state.selectedAnnotation === null) return
            const point = state.selectedAnnotation.resolve().points.find((c) => c.id === pointId)
            if (point === undefined) return

            const localPos = canvasToBitmapSpace(x, y)

            set({
              moveCurrent: [localPos[0] - point.x, localPos[1] - point.y],
              pointIdsBeingMoved: [pointId],
              annotationIdBeingMoved: state.selectedAnnotation.resolve().id,
              annotationDirty: true,
              hitTestDirty: true
            })

            set({ annotationDirty: true, hitTestDirty: true })
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

            const dataStore = useAppStore.getState().store
            const resolvedAnnotation = annotation.resolve()
            const pointsBeingMoved = new Set(state.pointIdsBeingMoved)

            const payload = normalizeAnnotationPoints({
              type: resolvedAnnotation.type,
              points: resolvedAnnotation.points.map((point) => {
                const diff = pointsBeingMoved.has(point.id) ? state.moveCurrent : [0, 0]
                return {
                  id: point.id,
                  x: point.x + diff[0],
                  y: point.y + diff[1]
                }
              })
            }).points

            const updateId = annotation.update({
              points: payload
            })

            set({
              annotationDirty: true,
              hitTestDirty: true,
              annotationIdBeingMoved: null,
              pointIdsBeingMoved: null
            })

            dataStore
              .replacePoints(payload)
              .then((resultPoints) => {
                annotation.commit(updateId)
                annotation.updateBase({
                  points: resultPoints
                })
              })
              .catch(() => {
                annotation.rollback(updateId)
              })
              .finally(() => {
                if (sampleId === get().sample?.resolve().id) {
                  set({ annotationDirty: true, hitTestDirty: true })
                }
              })
          },
          deleteAnnotation: (annotationId: string) => {
            const state = get()
            const annotations = state.sample?.resolve().annotations

            if (annotations === undefined) return

            const annotation = annotations.resolve()[annotationId]?.resolve() ?? null

            let selectedAnnotation = state.selectedAnnotation

            if (state.selectedAnnotation?.resolve().id === annotationId) {
              selectedAnnotation = null
            }

            if (annotation !== null) {
              const updateId = annotations.update({
                [annotation.id]: undefined
              })
              const store = useAppStore.getState().store
              freeAnnotationHitIds(annotationId)
              set({
                selectedAnnotation: selectedAnnotation,
                annotationDirty: true,
                hitTestDirty: true
              })
              const sampleId = state.sample?.resolve().id
              store
                .deleteAnnotations([annotation.id])
                .then((c) => {
                  if (!c[0]) {
                    throw new Error('Failed to delete annotation')
                  }
                  annotations.commit(updateId)
                })
                .catch(() => {
                  annotations.rollback(updateId)
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
          },
          deleteSelectedAnnotation: () => {
            const state = get()
            if (state.selectedAnnotation !== null) {
              const annotation = state.selectedAnnotation
              state.deleteAnnotation(annotation.resolve().id)
            }
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
              } else {
                return {
                  annotationId: hitAnnotationId,
                  controlPointId: null,
                  lineControlPointId: null
                }
              }
            }

            return null
          }
        }
      }),
    [labels]
  )

  return { store }
}
