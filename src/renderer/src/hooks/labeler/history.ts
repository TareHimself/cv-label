import type { StoreApi } from 'zustand'
import { AnnotationType, IAnnotation, IPoint } from '@shared/types'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { OptimisticObject } from '@renderer/util/optimistic_object'
import type { HitIdTracker } from './hitIds'
import type { HistoryEntry, LabelerStore } from './storeTypes'

type HistoryDeps = {
  get: StoreApi<LabelerStore>['getState']
  set: StoreApi<LabelerStore>['setState']
  hitIds: HitIdTracker
}

/** Undo/redo stack plus the optimistic-create/persist "apply*" primitives shared between direct mutation and undo/redo. */
export const createHistoryController = ({ get, set, hitIds }: HistoryDeps) => {
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
          hitIds.addAnnotationHitIds(results[0].id)
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

    const wasSelected = state.selectedAnnotation?.resolve().id === annotationId
    const selectedAnnotation = wasSelected ? null : state.selectedAnnotation

    const { commit, rollback } = annotations.update({
      [annotationId]: undefined
    })
    const dataStore = useAppStore.getState().store
    hitIds.freeAnnotationHitIds(annotationId, wasSelected)
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
          hitIds.addAnnotationHitIds(annotationId)
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
          hitIds.rebuildSelectedAnnotationHitIds(stillSelected.resolve())
        }
        if (sampleId === get().sample?.resolve().id) {
          set({ annotationDirty: true, hitTestDirty: true })
        }
      })
  }

  /** Optimistically relabels an annotation then persists it - also syncs the label picker if it's the selected annotation. */
  const applyRelabel = (annotationId: string, labelId: string) => {
    const state = get()
    const targetAnnotation = state.sample?.resolve().annotations.resolve()[annotationId] ?? null
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
          hitIds.rebuildSelectedAnnotationHitIds(stillSelected.resolve())
        }
        if (sampleId === get().sample?.resolve().id) {
          set({ annotationDirty: true, hitTestDirty: true })
        }
      })
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

  const undo = () => {
    const { undoStack } = get()
    const entry = undoStack[undoStack.length - 1]
    if (entry === undefined) return

    set({ undoStack: undoStack.slice(0, -1) })
    applyHistoryInverse(entry)
    set((s) => ({ redoStack: [...s.redoStack, entry] }))
  }

  const redo = () => {
    const { redoStack } = get()
    const entry = redoStack[redoStack.length - 1]
    if (entry === undefined) return

    set({ redoStack: redoStack.slice(0, -1) })
    applyHistoryForward(entry)
    set((s) => ({ undoStack: [...s.undoStack, entry] }))
  }

  return {
    pushHistory,
    applyCreateAnnotation,
    applyDeleteAnnotation,
    applyReplacePoints,
    applyRelabel,
    applyConvertType,
    undo,
    redo
  }
}
