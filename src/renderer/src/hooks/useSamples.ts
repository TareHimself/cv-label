import { navigateToLabel, useSamplesNavState } from '@renderer/navigation'
import { useCallback } from 'react'
import { useAppStore } from './useAppStore'
import { useQuery } from '@tanstack/react-query'

export const useSamples = () => {
  const store = useAppStore((s) => s.store)

  const { task, project } = useSamplesNavState()

  const {
    data: items = [],
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ['samples', task.id, store],
    queryFn: () => store.getSamplesForTask(task.id)
  })

  const loading = isLoading || isFetching

  const label = useCallback(
    (sampleId: string) => {
      const startAt = items.findIndex((c) => c.id == sampleId)
      // We send a copy because the label route handles cache and other things differently
      navigateToLabel(project, task, structuredClone(items), startAt)
    },
    [items, project, task]
  )

  return { items, loading, project, label }
}
