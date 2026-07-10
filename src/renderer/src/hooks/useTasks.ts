import { navigate } from '@renderer/router/appRouter'
import { INewSample, IProject, ITask, ITaskUpdate } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
//import toast from 'react-hot-toast'
//toast.promise()

export const useTasks = (project: IProject) => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()

  const tasksQueryKey = ['tasks', project.id, store] as const

  const { data: items = [], isLoading } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => store.getTasksForProject(project.id)
  })

  const { mutateAsync } = useMutation({
    mutationFn: ({ id, name, samples }: { id: string; name: string; samples: INewSample[] }) =>
      store.createTask(project.id, id, name, samples),
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
    async (name: string, samples: INewSample[]) => {
      await mutateAsync({ id: makeUUID(), name, samples })
    },
    [mutateAsync]
  )

  const open = useCallback(
    (item: ITask) => {
      navigate('samples', { project, task: item })
    },
    [project]
  )

  const { mutateAsync: updateMutateAsync } = useMutation({
    mutationFn: (update: ITaskUpdate) => store.updateTasks([update]).then((r) => r[0]),
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey })
      const previousTasks = queryClient.getQueryData<ITask[]>(tasksQueryKey) ?? []

      queryClient.setQueryData<ITask[]>(tasksQueryKey, (current = []) =>
        current.map((task) =>
          task.id === update.id ? { ...task, name: update.name ?? task.name } : task
        )
      )

      return { previousTasks }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<ITask[]>(tasksQueryKey, context?.previousTasks ?? [])
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    }
  })

  const update = useCallback(
    async (id: string, name: string) => {
      await updateMutateAsync({ id, name })
    },
    [updateMutateAsync]
  )

  const { mutateAsync: removeMutateAsync } = useMutation({
    mutationFn: (ids: string[]) => store.deleteTasks(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey })
      const previousTasks = queryClient.getQueryData<ITask[]>(tasksQueryKey) ?? []
      const idSet = new Set(ids)

      queryClient.setQueryData<ITask[]>(tasksQueryKey, (current = []) =>
        current.filter((task) => !idSet.has(task.id))
      )

      return { previousTasks }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<ITask[]>(tasksQueryKey, context?.previousTasks ?? [])
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    }
  })

  const remove = useCallback(
    async (id: string) => {
      await removeMutateAsync([id])
    },
    [removeMutateAsync]
  )

  const removeMany = useCallback(
    async (ids: string[]) => {
      await removeMutateAsync(ids)
    },
    [removeMutateAsync]
  )

  return { items, create, open, update, remove, removeMany, isLoading }
}
