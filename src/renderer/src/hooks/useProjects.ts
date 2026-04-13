import { ILabel, IProject } from '@shared/types'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { makeUUID } from '@shared/utils'
import { navigateToTasks } from '@renderer/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useProjects = () => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()
  const projectsQueryKey = ['projects', store] as const

  const { data: items = [] } = useQuery({
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

  const open = useCallback(async (item: IProject) => {
    await navigateToTasks(item)
  }, [])

  return { items, create, open }
}
