import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCopyAnnotations, type CopyAnnotationsPair } from '../useCopyAnnotations'
import { toOptimisticSample } from '@renderer/util/toOptimisticSample'
import { AnnotationType, IAnnotation, TrainingSplit } from '@shared/types'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

import { useAppStore } from '@renderer/hooks/useAppStore'
import { createMockDataStore } from '@renderer/__tests__/mockDataStore'

const makeSample = (
  id: string,
  opts: { width?: number; height?: number; annotations?: IAnnotation[] } = {}
) =>
  toOptimisticSample({
    id,
    name: id,
    split: TrainingSplit.Train,
    createdAt: new Date().toISOString(),
    imageUri: `cv-label-image://${id}`,
    width: opts.width ?? 100,
    height: opts.height ?? 100,
    completedAt: null,
    annotations: opts.annotations ?? []
  })

const annotationA: IAnnotation = {
  id: 'a1',
  type: AnnotationType.Box,
  labelId: 'l1',
  points: [
    { id: 'p1', x: 0, y: 0 },
    { id: 'p2', x: 10, y: 10 }
  ]
}

let queryClient: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  Object.assign(useAppStore.getState().store, createMockDataStore())
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
})

describe('useCopyAnnotations', () => {
  it("copies a source sample's annotations onto the destination with fresh ids", async () => {
    const source = makeSample('s1', { annotations: [annotationA] })
    const destination = makeSample('s2')
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockResolvedValue([])

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      await result.current.run([{ source, destination }])
    })

    expect(dataStore.createAnnotations).toHaveBeenCalledTimes(1)
    const [sampleId, annotations] = vi.mocked(dataStore.createAnnotations).mock.calls[0]
    expect(sampleId).toBe('s2')
    expect(annotations).toHaveLength(1)
    expect(annotations[0].id).not.toBe(annotationA.id)
    expect(annotations[0].type).toBe(annotationA.type)
    expect(annotations[0].labelId).toBe(annotationA.labelId)
    expect(annotations[0].points.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 10]
    ])
    expect(annotations[0].points[0].id).not.toBe(annotationA.points[0].id)

    expect(result.current.progress.copied).toBe(1)
    expect(result.current.progress.completed).toBe(1)
  })

  it('skips a destination sample that already has annotations', async () => {
    const source = makeSample('s1', { annotations: [annotationA] })
    const destination = makeSample('s2', { annotations: [annotationA] })
    const dataStore = useAppStore.getState().store

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      await result.current.run([{ source, destination }])
    })

    expect(dataStore.createAnnotations).not.toHaveBeenCalled()
    expect(result.current.progress.alreadyLabeled).toBe(1)
    expect(result.current.progress.total).toBe(0)
  })

  it('skips a pair whose source/destination dimensions differ', async () => {
    const source = makeSample('s1', { annotations: [annotationA], width: 100, height: 100 })
    const destination = makeSample('s2', { width: 200, height: 100 })
    const dataStore = useAppStore.getState().store

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      await result.current.run([{ source, destination }])
    })

    expect(dataStore.createAnnotations).not.toHaveBeenCalled()
    expect(result.current.progress.dimensionMismatch).toBe(1)
  })

  it('only copies into a duplicated destination once - first pair wins', async () => {
    const sourceA = makeSample('s1', { annotations: [annotationA] })
    const sourceB = makeSample('s2', { annotations: [annotationA] })
    const destination = makeSample('s3')
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockResolvedValue([])

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      await result.current.run([
        { source: sourceA, destination },
        { source: sourceB, destination }
      ])
    })

    expect(dataStore.createAnnotations).toHaveBeenCalledTimes(1)
    expect(result.current.progress.duplicateDestination).toBe(1)
    expect(result.current.progress.total).toBe(1)
  })

  it('keeps going past a per-pair failure and records it', async () => {
    const sourceA = makeSample('s1', { annotations: [annotationA] })
    const destinationA = makeSample('s2')
    const sourceB = makeSample('s3', { annotations: [annotationA] })
    const destinationB = makeSample('s4')
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([])

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      await result.current.run([
        { source: sourceA, destination: destinationA },
        { source: sourceB, destination: destinationB }
      ])
    })

    expect(dataStore.createAnnotations).toHaveBeenCalledTimes(2)
    expect(result.current.progress.completed).toBe(2)
    expect(result.current.progress.copied).toBe(1)
    expect(result.current.progress.failures).toEqual([
      { sampleId: 's2', sampleName: 's2', error: 'boom' }
    ])
  })

  it('invalidates the destination task samples query after the run', async () => {
    const source = makeSample('s1', { annotations: [annotationA] })
    const destination = makeSample('s2')
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockResolvedValue([])
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      await result.current.run([{ source, destination }])
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['samples', 't-dest', dataStore] })
  })

  it('does nothing for a sample with no annotations to copy', async () => {
    const source = makeSample('s1')
    const destination = makeSample('s2')
    const dataStore = useAppStore.getState().store

    const { result } = renderHook(() => useCopyAnnotations('t-dest'), { wrapper })

    await act(async () => {
      const pairs: CopyAnnotationsPair[] = [{ source, destination }]
      await result.current.run(pairs)
    })

    expect(dataStore.createAnnotations).not.toHaveBeenCalled()
    expect(result.current.progress.copied).toBe(0)
    expect(result.current.progress.completed).toBe(1)
  })
})
