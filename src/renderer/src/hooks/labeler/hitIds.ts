import { AnnotationType, IAnnotation } from '@shared/types'
import { ColorGenerator } from '@renderer/util/color_generator'

/** Sentinels for a Box's 2 derived corner handles (see moveAnnotationPoint) - safe as fixed literals since only one Box is ever selected at a time. */
export const BOX_CORNER_HANDLE_TOP_RIGHT = '__box-corner-top-right__'
export const BOX_CORNER_HANDLE_BOTTOM_LEFT = '__box-corner-bottom-left__'

/** A Box's 4 resizable edges (see moveAnnotationPoint) - unlike a Polygon's lines, these never go through addControlPoint. */
export const BOX_EDGE_TOP = '__box-edge-top__'
export const BOX_EDGE_RIGHT = '__box-edge-right__'
export const BOX_EDGE_BOTTOM = '__box-edge-bottom__'
export const BOX_EDGE_LEFT = '__box-edge-left__'

export class OneToOneMap<T, K> {
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

/** Owns the color-hit-id bookkeeping the canvas hit-test reads from - one instance per labeler store. */
export const createHitIdTracker = () => {
  const colorGenerator = new ColorGenerator()
  const hitIdToAnnotationId = new OneToOneMap<string, string>()
  const selectedAnnotationControlHitIds = new OneToOneMap<string, string>()
  const selectedAnnotationLineHitIds = new OneToOneMap<string, string>()

  const makeHitId = () => colorGenerator.make()
  const freeHitId = (id: string) => colorGenerator.free(id)

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

  /** Frees annotationId's own hit color, plus its selected-handle colors if it was the selected annotation. */
  const freeAnnotationHitIds = (annotationId: string, wasSelected: boolean) => {
    const hitId = hitIdToAnnotationId.getByValue(annotationId)
    if (hitId !== undefined) {
      freeHitId(hitId)
      hitIdToAnnotationId.delete(hitId)
    }
    if (wasSelected) {
      clearSelectedAnnotationHitIds()
    }
  }

  const addAnnotationHitIds = (annotationId: string) => {
    const hitId = makeHitId()
    hitIdToAnnotationId.set(hitId, annotationId)
  }

  return {
    colorGenerator,
    hitIdToAnnotationId,
    selectedAnnotationControlHitIds,
    selectedAnnotationLineHitIds,
    makeHitId,
    freeHitId,
    clearSelectedAnnotationHitIds,
    rebuildSelectedAnnotationHitIds,
    addSelectedAnnotationPointId,
    clearSelectedAnnotationPointId,
    freeAnnotationHitIds,
    addAnnotationHitIds
  }
}

export type HitIdTracker = ReturnType<typeof createHitIdTracker>
