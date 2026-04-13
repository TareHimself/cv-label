import { navigateToSamples, useTasksNavState } from '@renderer/navigation'
import { fileToBase64, normalizeFilename } from '@renderer/utils'
import { INewSample, ITask, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
//import toast from 'react-hot-toast'
//toast.promise()

export const useTasks = () => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()

  const { project } = useTasksNavState()
  const tasksQueryKey = ['tasks', project.id, store] as const

  const { data: items = [] } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => store.getTasksForProject(project.id)
  })

  const { mutateAsync } = useMutation({
    mutationFn: ({ id, name, files }: { id: string; name: string; files: File[] }) => {
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

        return store.createTask(project.id, id, name, newSamples)
      })()
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey })
      const previousTasks = queryClient.getQueryData<ITask[]>(tasksQueryKey) ?? []

      queryClient.setQueryData<ITask[]>(tasksQueryKey, (current = []) => [...current, { id, name }])

      return { previousTasks, optimisticId: id }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<ITask[]>(tasksQueryKey, context?.previousTasks ?? [])
    },
    onSuccess: (task, _variables, context) => {
      queryClient.setQueryData<ITask[]>(tasksQueryKey, (current = []) =>
        current.map((existingTask) =>
          existingTask.id === context?.optimisticId ? task : existingTask
        )
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    }
  })

  const create = useCallback(
    async (name: string, files: File[]) => {
      await mutateAsync({ id: makeUUID(), name, files })
    },
    [mutateAsync]
  )

  const open = useCallback(
    async (item: ITask) => {
      await navigateToSamples(project, item)
    },
    [project]
  )

  return { items, create, open }
}
