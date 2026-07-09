import { navigate } from '@renderer/router/appRouter'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { OptimisticObject } from '@renderer/util/optimistic_object'
import { IAnnotation, INewSample, IProject, ITask } from '@shared/types'
import { OptimisticSample } from '@renderer/types'

export const useSamples = (project: IProject, task: ITask) => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()

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
    mutationFn: (samples: INewSample[]) => store.createSamples(task.id, samples),
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
      navigate('label', { project, task, samples: items, initial: startAt })
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
    label,
    remove,
    createSamples: createSamplesMutation.mutateAsync,
    isCreatingSamples: createSamplesMutation.isPending
  }
}
