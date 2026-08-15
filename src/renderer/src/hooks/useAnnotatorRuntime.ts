import type { AnnotatorLabel } from '@renderer/types'
import { create } from 'zustand'

type AnnotatorRuntimeEntry = {
  labels: AnnotatorLabel[]
  mappingByProjectId: Record<string, Record<string, string | null>>
}

type AnnotatorRuntimeState = {
  entries: Record<string, AnnotatorRuntimeEntry>
}

type AnnotatorRuntimeActions = {
  activate: (annotatorId: string, labels: AnnotatorLabel[]) => void
  setMapping: (
    annotatorId: string,
    projectId: string,
    mapping: Record<string, string | null>
  ) => void
  forget: (annotatorId: string) => void
}

/** Deliberately plain in-memory state, not backed by any store/database - an annotator's
 *  label vocabulary and its mapping against a project's labels are only ever known once
 *  the app connects to it (see components/annotators/AnnotatorsModal.tsx), and both are
 *  discarded on reload rather than persisted anywhere. */
export const useAnnotatorRuntime = create<AnnotatorRuntimeState & AnnotatorRuntimeActions>(
  (set) => ({
    entries: {},

    activate: (annotatorId, labels) =>
      set((state) => ({
        entries: {
          ...state.entries,
          [annotatorId]: {
            labels,
            mappingByProjectId: state.entries[annotatorId]?.mappingByProjectId ?? {}
          }
        }
      })),

    setMapping: (annotatorId, projectId, mapping) =>
      set((state) => {
        const existing = state.entries[annotatorId]
        if (existing === undefined) return state

        return {
          entries: {
            ...state.entries,
            [annotatorId]: {
              ...existing,
              mappingByProjectId: { ...existing.mappingByProjectId, [projectId]: mapping }
            }
          }
        }
      }),

    forget: (annotatorId) =>
      set((state) => {
        if (!(annotatorId in state.entries)) return state
        const entries = { ...state.entries }
        delete entries[annotatorId]
        return { entries }
      })
  })
)
