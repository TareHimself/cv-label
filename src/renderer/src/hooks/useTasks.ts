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
    onMutate: async ({ id, name, samples }) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey })
      const previousTasks = queryClient.getQueryData<ITask[]>(tasksQueryKey) ?? []

      queryClient.setQueryData<ITask[]>(tasksQueryKey, (current = []) => [
        ...current,
        { id, name, sampleCount: samples.length, completedSampleCount: 0 }
      ])

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

  // Tags are picked by id (see hooks/useTags.ts for the project's vocabulary) and
  // attached/detached across a whole batch of task ids in one call (see
  // IDataStore.addTagsToTasks) - simple invalidate-on-success here rather than granular
  // optimistic patching, since tagging isn't perf-sensitive and the resulting per-task
  // tag lists are easiest to just re-fetch.
  const { mutateAsync: addTagsMutateAsync } = useMutation({
    mutationFn: ({ taskIds, tagIds }: { taskIds: string[]; tagIds: string[] }) =>
      store.addTagsToTasks(taskIds, tagIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksQueryKey })
  })

  const addTags = useCallback(
    async (taskIds: string[], tagIds: string[]) => {
      if (taskIds.length === 0 || tagIds.length === 0) return
      await addTagsMutateAsync({ taskIds, tagIds })
    },
    [addTagsMutateAsync]
  )

  const { mutateAsync: removeTagsMutateAsync } = useMutation({
    mutationFn: ({ taskIds, tagIds }: { taskIds: string[]; tagIds: string[] }) =>
      store.removeTagsFromTasks(taskIds, tagIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksQueryKey })
  })

  const removeTags = useCallback(
    async (taskIds: string[], tagIds: string[]) => {
      if (taskIds.length === 0 || tagIds.length === 0) return
      await removeTagsMutateAsync({ taskIds, tagIds })
    },
    [removeTagsMutateAsync]
  )

  return { items, create, open, update, remove, removeMany, addTags, removeTags, isLoading }
}
