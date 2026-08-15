import { ILabel, IProject, IProjectUpdate } from '@shared/types'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { makeUUID } from '@shared/utils'
import { navigate } from '@renderer/router/appRouter'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useProjects = () => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()
  const projectsQueryKey = ['projects', store] as const

  const { data: items = [], isLoading } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => store.getProjects()
  })

  const { mutateAsync } = useMutation({
    mutationFn: ({ id, name, labels }: { id: string; name: string; labels: ILabel[] }) =>
      store.createProject(id, name, labels),
    onMutate: async ({ id, name, labels }) => {
      await queryClient.cancelQueries({ queryKey: projectsQueryKey })
      const previousProjects = queryClient.getQueryData<IProject[]>(projectsQueryKey) ?? []

      queryClient.setQueryData<IProject[]>(projectsQueryKey, (current = []) => [
        ...current,
        { id, name, labels }
      ])

      return { previousProjects, optimisticId: id }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<IProject[]>(projectsQueryKey, context?.previousProjects ?? [])
    },
    onSuccess: (newProject, _variables, context) => {
      queryClient.setQueryData<IProject[]>(projectsQueryKey, (current = []) =>
        current.map((project) => (project.id === context?.optimisticId ? newProject : project))
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey })
    }
  })

  const create = useCallback(
    async (name: string, labels: ILabel[]) => {
      await mutateAsync({ id: makeUUID(), name, labels })
    },
    [mutateAsync]
  )

  const open = useCallback((item: IProject) => {
    navigate('tasks', { project: item })
  }, [])

  const { mutateAsync: updateMutateAsync } = useMutation({
    mutationFn: (update: IProjectUpdate) => store.updateProjects([update]).then((r) => r[0]),
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: projectsQueryKey })
      const previousProjects = queryClient.getQueryData<IProject[]>(projectsQueryKey) ?? []

      queryClient.setQueryData<IProject[]>(projectsQueryKey, (current = []) =>
        current.map((project) => {
          if (project.id !== update.id) return project
          const existingIds = new Set(project.labels.map((l) => l.id))
          // A label id the project doesn't have yet is a new one being added (see
          // IProjectUpdate), not a rename - append it rather than dropping it on the
          // floor until the post-mutation refetch catches up.
          const newLabels = (update.labels ?? []).filter((l) => !existingIds.has(l.id))
          return {
            ...project,
            name: update.name ?? project.name,
            labels: [
              ...project.labels.map((label) => {
                const updated = update.labels?.find((l) => l.id === label.id)
                return updated ? { ...label, name: updated.name, color: updated.color } : label
              }),
              ...newLabels
            ]
          }
        })
      )

      return { previousProjects }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<IProject[]>(projectsQueryKey, context?.previousProjects ?? [])
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey })
    }
  })

  const update = useCallback(
    async (id: string, name: string, labels: Pick<ILabel, 'id' | 'name' | 'color'>[]) => {
      await updateMutateAsync({ id, name, labels })
    },
    [updateMutateAsync]
  )

  const { mutateAsync: removeMutateAsync } = useMutation({
    mutationFn: (ids: string[]) => store.deleteProjects(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: projectsQueryKey })
      const previousProjects = queryClient.getQueryData<IProject[]>(projectsQueryKey) ?? []
      const idSet = new Set(ids)

      queryClient.setQueryData<IProject[]>(projectsQueryKey, (current = []) =>
        current.filter((project) => !idSet.has(project.id))
      )

      return { previousProjects }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<IProject[]>(projectsQueryKey, context?.previousProjects ?? [])
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey })
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
