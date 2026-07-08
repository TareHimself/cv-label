import { navigateToLabel, useSamplesNavState } from '@renderer/navigation'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { OptimisticObject } from '@renderer/util/optimistic_object'
import { IAnnotation, INewSample, TrainingSplit } from '@shared/types'
import { fileToBase64, normalizeFilename } from '@renderer/utils'
import { makeUUID } from '@shared/utils'
import { OptimisticSample } from '@renderer/types'

export const useSamples = () => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()

  const { task, project } = useSamplesNavState()
  const samplesQueryKey = ['samples', task.id, store] as const

  const {
    data: items = [],
    isLoading,
    isFetching
  } = useQuery({
    queryKey: samplesQueryKey,
    queryFn: () =>
      store.getSamplesForTask(task.id).then((a) =>
        a.map((c) => {
          const annotationsObj = c.annotations.reduce<{
            [key: string]: OptimisticObject<IAnnotation>
          }>((t, c) => {
            return { ...t, [c.id]: new OptimisticObject(c) }
          }, {})

          return new OptimisticObject({
            ...c,
            annotations: new OptimisticObject(annotationsObj, true)
          })
        })
      )
  })

  const loading = isLoading || isFetching

  const createSamplesMutation = useMutation({
    mutationFn: (files: File[]) => {
      return (async () => {
        const base64Data = await Promise.all(files.map((c) => fileToBase64(c)))
        const newSamples = files.map<INewSample>((c, idx) => {
          return {
            id: makeUUID(),
            name: normalizeFilename(c.name),
            base64Image: base64Data[idx],
            split: TrainingSplit.Train,
            annotations: [],
            createdAt: new Date().toISOString()
          }
        })

        return store.createSamples(task.id, newSamples)
      })()
    },
    onSuccess: async () => {
      // Wait for all existing samples to complete pending operations
      await Promise.all(items.map((sample) => sample.waitForResolve()))

      // Then refetch the samples
      queryClient.invalidateQueries({ queryKey: samplesQueryKey })
    }
  })

  const label = useCallback(
    (sampleId: string) => {
      const startAt = items.findIndex((c) => c.resolve().id == sampleId)
      // We send a copy because the label route handles cache and other things differently
      navigateToLabel(project, task, items, startAt)
    },
    [items, project, task]
  )

  const { mutateAsync: removeMutateAsync } = useMutation({
    mutationFn: (id: string) => store.deleteSamples([id]),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: samplesQueryKey })
      const previousItems = queryClient.getQueryData<OptimisticSample[]>(samplesQueryKey) ?? []

      queryClient.setQueryData<OptimisticSample[]>(samplesQueryKey, (current = []) =>
        current.filter((sample) => sample.resolve().id !== id)
      )

      return { previousItems }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<OptimisticSample[]>(samplesQueryKey, context?.previousItems ?? [])
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: samplesQueryKey })
    }
  })

  const remove = useCallback(
    async (id: string) => {
      await removeMutateAsync(id)
    },
    [removeMutateAsync]
  )

  return {
    items,
    loading,
    project,
    label,
    remove,
    createSamples: createSamplesMutation.mutateAsync,
    isCreatingSamples: createSamplesMutation.isPending
  }
}
