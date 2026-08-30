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
export class HitIdTracker {
  readonly colorGenerator = new ColorGenerator()
  readonly hitIdToAnnotationId = new OneToOneMap<string, string>()
  readonly selectedAnnotationControlHitIds = new OneToOneMap<string, string>()
  readonly selectedAnnotationLineHitIds = new OneToOneMap<string, string>()

  makeHitId(): string {
    return this.colorGenerator.make()
  }

  freeHitId(id: string): void {
    this.colorGenerator.free(id)
  }

  clearSelectedAnnotationHitIds(): void {
    for (const hitId of this.selectedAnnotationControlHitIds.keys()) {
      this.freeHitId(hitId)
    }

    for (const hitId of this.selectedAnnotationLineHitIds.keys()) {
      this.freeHitId(hitId)
    }

    this.selectedAnnotationControlHitIds.clear()
    this.selectedAnnotationLineHitIds.clear()
  }

  /** Rebuilds a selected annotation's hit ids from scratch - a Box's derived corner/edge handles only ever get set up here, not per-point. */
  rebuildSelectedAnnotationHitIds(annotation: IAnnotation): void {
    this.clearSelectedAnnotationHitIds()

    for (const point of annotation.points) {
      this.selectedAnnotationControlHitIds.set(this.makeHitId(), point.id)
    }

    if (annotation.type === AnnotationType.Polygon) {
      for (const point of annotation.points) {
        this.selectedAnnotationLineHitIds.set(this.makeHitId(), point.id)
      }
    } else if (annotation.type === AnnotationType.Box) {
      this.selectedAnnotationControlHitIds.set(this.makeHitId(), BOX_CORNER_HANDLE_TOP_RIGHT)
      this.selectedAnnotationControlHitIds.set(this.makeHitId(), BOX_CORNER_HANDLE_BOTTOM_LEFT)
      this.selectedAnnotationLineHitIds.set(this.makeHitId(), BOX_EDGE_TOP)
      this.selectedAnnotationLineHitIds.set(this.makeHitId(), BOX_EDGE_RIGHT)
      this.selectedAnnotationLineHitIds.set(this.makeHitId(), BOX_EDGE_BOTTOM)
      this.selectedAnnotationLineHitIds.set(this.makeHitId(), BOX_EDGE_LEFT)
    }
  }

  clearSelectedAnnotationPointId(pointId: string): void {
    {
      const hitId = this.selectedAnnotationControlHitIds.getByValue(pointId)
      if (hitId !== undefined) {
        this.freeHitId(hitId)
        this.selectedAnnotationControlHitIds.delete(pointId)
      }
    }
    {
      const hitId = this.selectedAnnotationLineHitIds.getByValue(pointId)
      if (hitId !== undefined) {
        this.freeHitId(hitId)
        this.selectedAnnotationLineHitIds.delete(pointId)
      }
    }
  }

  addSelectedAnnotationPointId(pointId: string): void {
    this.clearSelectedAnnotationPointId(pointId)
    {
      const hitId = this.makeHitId()
      this.selectedAnnotationControlHitIds.set(hitId, pointId)
    }
    {
      const hitId = this.makeHitId()
      this.selectedAnnotationLineHitIds.set(hitId, pointId)
    }
  }

  /** Frees annotationId's own hit color, plus its selected-handle colors if it was the selected annotation. */
  freeAnnotationHitIds(annotationId: string, wasSelected: boolean): void {
    const hitId = this.hitIdToAnnotationId.getByValue(annotationId)
    if (hitId !== undefined) {
      this.freeHitId(hitId)
      this.hitIdToAnnotationId.delete(hitId)
    }
    if (wasSelected) {
      this.clearSelectedAnnotationHitIds()
    }
  }

  addAnnotationHitIds(annotationId: string): void {
    const hitId = this.makeHitId()
    this.hitIdToAnnotationId.set(hitId, annotationId)
  }
}
