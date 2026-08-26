import { errorToString } from '@shared/utils'
import { IAnnotator } from '@shared/types'
import { OptimisticSample } from '@renderer/types'
import { runAnnotatorOnSample } from '@renderer/api/ExternalAnnotator'
import { useAppStore } from './useAppStore'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export type RunAnnotatorFailure = {
  sampleId: string
  sampleName: string
  error: string
}

export type RunAnnotatorProgress = {
  total: number
  completed: number
  created: number
  skipped: number
  alreadyLabeled: number
  failures: RunAnnotatorFailure[]
}

const INITIAL_PROGRESS: RunAnnotatorProgress = {
  total: 0,
  completed: 0,
  created: 0,
  skipped: 0,
  alreadyLabeled: 0,
  failures: []
}

/** Runs an annotator over samples, skipping any already-annotated one. Sequential, keeps going past a per-sample failure. `taskIds` covers every task the samples were drawn from, so each cache gets invalidated when the run finishes. */
export const useRunAnnotator = (taskIds: string[]) => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<RunAnnotatorProgress>(INITIAL_PROGRESS)
  const [isRunning, setIsRunning] = useState(false)
  // Distinct from isRunning (flips back once finished) and progress.total (legitimately 0 when already labeled) - only run()/reset() touch this.
  const [hasRun, setHasRun] = useState(false)

  const run = useCallback(
    async (
      annotator: IAnnotator,
      labelMapping: Record<string, string | null>,
      samples: OptimisticSample[]
    ) => {
      const targets = samples.filter(
        (sample) => Object.keys(sample.resolve().annotations.resolve()).length === 0
      )
      const alreadyLabeled = samples.length - targets.length

      setHasRun(true)
      setIsRunning(true)
      setProgress({ ...INITIAL_PROGRESS, total: targets.length, alreadyLabeled })

      for (const sample of targets) {
        const resolved = sample.resolve()
        try {
          const { annotations, skipped } = await runAnnotatorOnSample(
            annotator,
            labelMapping,
            resolved
          )
          if (annotations.length > 0) {
            await store.createAnnotations(resolved.id, annotations)
          }
          setProgress((current) => ({
            ...current,
            completed: current.completed + 1,
            created: current.created + annotations.length,
            skipped: current.skipped + skipped
          }))
        } catch (error) {
          setProgress((current) => ({
            ...current,
            completed: current.completed + 1,
            failures: [
              ...current.failures,
              { sampleId: resolved.id, sampleName: resolved.name, error: errorToString(error) }
            ]
          }))
        }
      }

      // Awaited before clearing isRunning - an immediate re-Run must see the annotations just created, not a stale snapshot.
      await Promise.all(
        taskIds.map((taskId) =>
          queryClient.invalidateQueries({ queryKey: ['samples', taskId, store] })
        )
      )
      setIsRunning(false)
    },
    [store, queryClient, taskIds]
  )

  const reset = useCallback(() => {
    setProgress(INITIAL_PROGRESS)
    setHasRun(false)
  }, [])

  return { run, reset, progress, isRunning, hasRun }
}
