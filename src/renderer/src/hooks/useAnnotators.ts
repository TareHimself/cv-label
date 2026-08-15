import { useCallback } from 'react'
import { makeUUID } from '@shared/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
const ANNOTATORS_QUERY_KEY = ['annotators'] as const
/** Annotators are store-agnostic and project-agnostic app-level data (see
 *  main/appStore.ts) - fetched straight off window.appStore rather than through
 *  useAppStore's pluggable IDataStore, the same way window.system/window.exportApi are
 *  called directly elsewhere without going through a zustand slice. */
export const useAnnotators = () => {
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ANNOTATORS_QUERY_KEY,
    queryFn: () => window.appStore.getAnnotators()
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ANNOTATORS_QUERY_KEY }),
    [queryClient]
  )

  const { mutateAsync: createMutateAsync } = useMutation({
    mutationFn: ({
      id,
      name,
      url,
      headers
    }: {
      id: string
      name: string
      url: string
      headers: Record<string, string>
    }) => window.appStore.createAnnotator(id, name, url, headers),
    onSuccess: invalidate
  })

  const create = useCallback(
    async (name: string, url: string, headers: Record<string, string>) => {
      const id = makeUUID()
      await createMutateAsync({ id, name, url, headers })
      return id
    },
    [createMutateAsync]
  )

  const { mutateAsync: updateMutateAsync } = useMutation({
    mutationFn: ({
      id,
      name,
      url,
      headers
    }: {
      id: string
      name: string
      url: string
      headers: Record<string, string>
    }) => window.appStore.updateAnnotators([{ id, name, url, headers }]),
    onSuccess: invalidate
  })

  const update = useCallback(
    async (id: string, name: string, url: string, headers: Record<string, string>) => {
      await updateMutateAsync({ id, name, url, headers })
    },
    [updateMutateAsync]
  )

  const { mutateAsync: removeMutateAsync } = useMutation({
    mutationFn: (ids: string[]) => window.appStore.deleteAnnotators(ids),
    onSuccess: invalidate
  })

  const remove = useCallback(
    async (id: string) => {
      await removeMutateAsync([id])
    },
    [removeMutateAsync]
  )

  return { items, isLoading, create, update, remove }
}
