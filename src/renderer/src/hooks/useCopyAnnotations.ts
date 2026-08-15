import { errorToString, makeUUID } from '@shared/utils'
import { INewAnnotation } from '@shared/types'
import { OptimisticSample } from '@renderer/types'
import { useAppStore } from './useAppStore'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export type CopyAnnotationsPair = {
  source: OptimisticSample
  destination: OptimisticSample
}

export type CopyAnnotationsFailure = {
  sampleId: string
  sampleName: string
  error: string
}

export type CopyAnnotationsProgress = {
  total: number
  completed: number
  copied: number
  alreadyLabeled: number
  dimensionMismatch: number
  duplicateDestination: number
  failures: CopyAnnotationsFailure[]
}

const INITIAL_PROGRESS: CopyAnnotationsProgress = {
  total: 0,
  completed: 0,
  copied: 0,
  alreadyLabeled: 0,
  dimensionMismatch: 0,
  duplicateDestination: 0,
  failures: []
}

/** Copies each pair's source-sample annotations onto its destination sample, skipping a
 *  pair whose destination already has annotations (never overwrite manual work), whose
 *  source/destination dimensions differ (points are absolute pixel coordinates, so a
 *  verbatim copy is only correct when the images are the same size), or whose destination
 *  was already claimed by an earlier pair in this same run (first pair mapped to a given
 *  destination wins - prevents double-copying into it). Runs sequentially and keeps going
 *  past a per-pair failure, same as useRunAnnotator. */
export const useCopyAnnotations = (destinationTaskId: string) => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<CopyAnnotationsProgress>(INITIAL_PROGRESS)
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(
    async (pairs: CopyAnnotationsPair[]) => {
      const seenDestinationIds = new Set<string>()
      const targets: CopyAnnotationsPair[] = []
      let alreadyLabeled = 0
      let dimensionMismatch = 0
      let duplicateDestination = 0

      for (const pair of pairs) {
        const destination = pair.destination.resolve()
        if (seenDestinationIds.has(destination.id)) {
          duplicateDestination++
          continue
        }
        seenDestinationIds.add(destination.id)

        if (Object.keys(destination.annotations.resolve()).length > 0) {
          alreadyLabeled++
          continue
        }

        const source = pair.source.resolve()
        if (source.width !== destination.width || source.height !== destination.height) {
          dimensionMismatch++
          continue
        }

        targets.push(pair)
      }

      setIsRunning(true)
      setProgress({
        ...INITIAL_PROGRESS,
        total: targets.length,
        alreadyLabeled,
        dimensionMismatch,
        duplicateDestination
      })

      for (const pair of targets) {
        const source = pair.source.resolve()
        const destination = pair.destination.resolve()
        const newAnnotations: INewAnnotation[] = Object.values(source.annotations.resolve())
          .map((a) => a.resolve())
          .map((a) => ({
            id: makeUUID(),
            type: a.type,
            labelId: a.labelId,
            points: a.points.map((p) => ({ id: makeUUID(), x: p.x, y: p.y }))
          }))

        try {
          if (newAnnotations.length > 0) {
            await store.createAnnotations(destination.id, newAnnotations)
          }
          setProgress((current) => ({
            ...current,
            completed: current.completed + 1,
            copied: current.copied + newAnnotations.length
          }))
        } catch (error) {
          setProgress((current) => ({
            ...current,
            completed: current.completed + 1,
            failures: [
              ...current.failures,
              {
                sampleId: destination.id,
                sampleName: destination.name,
                error: errorToString(error)
              }
            ]
          }))
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['samples', destinationTaskId, store] })
      setIsRunning(false)
    },
    [store, queryClient, destinationTaskId]
  )

  const reset = useCallback(() => setProgress(INITIAL_PROGRESS), [])

  return { run, reset, progress, isRunning }
}
