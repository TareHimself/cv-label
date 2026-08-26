import { IProject } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/** A project's tag vocabulary - managed from one place (ManageTagsModal); elsewhere a tag is always picked from `items` by id. */
export const useTags = (project: IProject) => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()
  const tagsQueryKey = ['tags', project.id, store] as const
  const tasksQueryKey = ['tasks', project.id, store] as const

  const { data: items = [], isLoading } = useQuery({
    queryKey: tagsQueryKey,
    queryFn: () => store.getTagsForProject(project.id)
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: tagsQueryKey }),
    [queryClient, tagsQueryKey]
  )

  // A rename/delete changes what's embedded in each task's own `tags` field too - not
  // needed for create, which can't affect any task's existing tags.
  const invalidateTasksToo = useCallback(
    () => queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
    [queryClient, tasksQueryKey]
  )

  const { mutateAsync: createMutateAsync } = useMutation({
    mutationFn: (name: string) => store.createTag(project.id, makeUUID(), name),
    onSuccess: invalidate
  })

  const create = useCallback(async (name: string) => createMutateAsync(name), [createMutateAsync])

  const { mutateAsync: renameMutateAsync } = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => store.updateTags([{ id, name }]),
    onSuccess: () => {
      invalidate()
      invalidateTasksToo()
    }
  })

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameMutateAsync({ id, name })
    },
    [renameMutateAsync]
  )

  const { mutateAsync: removeMutateAsync } = useMutation({
    mutationFn: (id: string) => store.deleteTags([id]),
    onSuccess: () => {
      invalidate()
      invalidateTasksToo()
    }
  })

  const remove = useCallback(
    async (id: string) => {
      await removeMutateAsync(id)
    },
    [removeMutateAsync]
  )

  return { items, isLoading, create, rename, remove }
}
