import { useAppStore } from '@renderer/hooks/useAppStore'

export const makeTaskKey = (projectId: string, taskId: string) => {
  const store = useAppStore.getState().store
  return [projectId, taskId, store]
}

export const makeSampleKey = (projectId: string, taskId: string, sampleId: string) => {
  const store = useAppStore.getState().store
  return [projectId, taskId, sampleId, store]
}
