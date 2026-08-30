import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useLabeler,
  BOX_CORNER_HANDLE_TOP_RIGHT,
  BOX_CORNER_HANDLE_BOTTOM_LEFT,
  BOX_EDGE_TOP,
  BOX_EDGE_RIGHT,
  BOX_EDGE_BOTTOM,
  BOX_EDGE_LEFT
} from '../useLabeler'
import { toOptimisticSample } from '@renderer/util/toOptimisticSample'
import { LabelerMode } from '@renderer/types'
import { AnnotationType, IAnnotation, ILabel, IPoint, TrainingSplit } from '@shared/types'

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

const labels: ILabel[] = [
  { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
  { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
]

const makeSample = (annotations: IAnnotation[] = []) =>
  toOptimisticSample({
    id: 'sample-1',
    name: 'sample-1',
    split: TrainingSplit.Train,
    createdAt: new Date().toISOString(),
    imageUri: 'about:blank',
    width: 100,
    height: 100,
    completedAt: null,
    annotations
  })

const setup = (annotations: IAnnotation[] = []) => {
  const { result } = renderHook(() => useLabeler(labels))
  const { store } = result.current
  // Bypasses setSample()'s real bitmap-load/hit-id bookkeeping (irrelevant to the
  // mutation/undo-redo logic under test) - direct state injection is fine except in the
  // dedicated "setSample clears history" test below, which calls the real action.
  act(() => store.setState({ sample: makeSample(annotations) }))
  return store
}

// Lets any pending .then/.catch/.finally chain (however deep) drain before asserting -
// a plain `await Promise.resolve()` only advances one microtask tick, which isn't always
// enough for the 2-3-deep chains in useLabeler's apply* primitives.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const annotationA: IAnnotation = {
  id: 'a1',
  type: AnnotationType.Box,
  labelId: 'l1',
  points: [
    { id: 'p1', x: 0, y: 0 },
    { id: 'p2', x: 10, y: 10 }
  ]
}

const annotationB: IAnnotation = {
  id: 'a2',
  type: AnnotationType.Box,
  labelId: 'l1',
  points: [
    { id: 'p3', x: 20, y: 20 },
    { id: 'p4', x: 30, y: 30 }
  ]
}

beforeEach(() => {
  // Fresh vi.fn()s (default resolved values, cleared call history) each test - mutating
  // the existing store object's properties rather than reassigning it, since useLabeler's
  // closures hold onto `useAppStore.getState().store` as a stable reference.
  Object.assign(useAppStore.getState().store, createMockDataStore())
})

describe('useLabeler undo/redo', () => {
  it('undoes and redoes a create', async () => {
    const store = setup([])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )
    vi.mocked(dataStore.deleteAnnotations).mockResolvedValue([true])
    act(() =>
      store.setState({
        bitmap: { width: 100, height: 100 } as ImageBitmap,
        imageRect: { x: 0, y: 0, width: 100, height: 100 }
      })
    )

    await act(async () => {
      store.getState().setMode(LabelerMode.CreateBox)
      store.getState().onConfirmPoint(10, 10)
      store.getState().onConfirmPoint(10, 10)
      await flush()
    })

    const createdIds = Object.keys(store.getState().sample!.resolve().annotations.resolve())
    expect(createdIds).toHaveLength(1)
    const [createdId] = createdIds

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    expect(dataStore.deleteAnnotations).toHaveBeenCalledWith([createdId])
    expect(store.getState().sample!.resolve().annotations.resolve()[createdId]).toBeUndefined()

    await act(async () => {
      store.getState().redo()
      await flush()
    })

    expect(dataStore.createAnnotations).toHaveBeenCalledTimes(2)
    expect(store.getState().sample!.resolve().annotations.resolve()[createdId]).toBeDefined()
  })

  it('undoes a delete, recreating the annotation with its original id', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.deleteAnnotations).mockResolvedValue([true])
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )

    await act(async () => {
      store.getState().deleteAnnotation('a1')
      await flush()
    })
    expect(store.getState().sample!.resolve().annotations.resolve().a1).toBeUndefined()

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    expect(dataStore.createAnnotations).toHaveBeenCalledWith('sample-1', [annotationA])
    expect(store.getState().sample!.resolve().annotations.resolve().a1).toBeDefined()
  })

  it('undoes a move, restoring the original points', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.replacePoints).mockImplementation(async (_id, points) =>
      (points as IPoint[]).map((p) => ({ id: p.id, x: p.x, y: p.y }))
    )

    act(() => {
      store.getState().selectAnnotation('a1')
      store.getState().moveSelectedAnnotationBy(5, 5)
    })
    await act(async () => {
      store.getState().commitAnnotationMove('a1')
      await flush()
    })

    const moved = store.getState().sample!.resolve().annotations.resolve().a1.resolve().points
    expect(moved.map((p) => [p.x, p.y])).toEqual([
      [5, 5],
      [15, 15]
    ])

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    const restored = store.getState().sample!.resolve().annotations.resolve().a1.resolve().points
    expect(restored.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 10]
    ])
  })

  it('undoes a relabel', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.updateAnnotations).mockImplementation(async (updates) =>
      updates.map((u) => ({ ...annotationA, ...u }))
    )

    await act(async () => {
      store.getState().setAnnotationLabelId('a1', 'l2')
      await flush()
    })
    expect(store.getState().sample!.resolve().annotations.resolve().a1.resolve().labelId).toBe('l2')

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    expect(store.getState().sample!.resolve().annotations.resolve().a1.resolve().labelId).toBe('l1')
    expect(dataStore.updateAnnotations).toHaveBeenLastCalledWith([{ id: 'a1', labelId: 'l1' }])
  })

  it('clears the redo stack when a new mutation happens', async () => {
    const store = setup([annotationA, annotationB])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.deleteAnnotations).mockResolvedValue([true])

    await act(async () => {
      store.getState().deleteAnnotation('a1')
      await flush()
    })
    await act(async () => {
      store.getState().undo()
      await flush()
    })
    expect(store.getState().redoStack).toHaveLength(1)

    await act(async () => {
      store.getState().deleteAnnotation('a2')
      await flush()
    })

    expect(store.getState().redoStack).toHaveLength(0)
  })

  it('clears both stacks when the sample changes', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.deleteAnnotations).mockResolvedValue([true])
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )

    await act(async () => {
      store.getState().deleteAnnotation('a1')
      await flush()
    })
    await act(async () => {
      store.getState().undo()
      await flush()
    })
    expect(store.getState().undoStack.length + store.getState().redoStack.length).toBeGreaterThan(0)

    act(() => {
      store.getState().setSample(makeSample([]))
    })

    expect(store.getState().undoStack).toEqual([])
    expect(store.getState().redoStack).toEqual([])
  })

  it('undo is a no-op with an empty history', () => {
    const store = setup([])
    const dataStore = useAppStore.getState().store
    const sampleBefore = store.getState().sample

    act(() => store.getState().undo())

    expect(dataStore.deleteAnnotations).not.toHaveBeenCalled()
    expect(dataStore.createAnnotations).not.toHaveBeenCalled()
    expect(dataStore.replacePoints).not.toHaveBeenCalled()
    expect(dataStore.updateAnnotations).not.toHaveBeenCalled()
    expect(store.getState().sample).toBe(sampleBefore)
  })

  it('redo is a no-op with an empty history', () => {
    const store = setup([])
    const dataStore = useAppStore.getState().store

    act(() => store.getState().redo())

    expect(dataStore.deleteAnnotations).not.toHaveBeenCalled()
    expect(dataStore.createAnnotations).not.toHaveBeenCalled()
    expect(dataStore.replacePoints).not.toHaveBeenCalled()
    expect(dataStore.updateAnnotations).not.toHaveBeenCalled()
  })
})

describe('useLabeler box creation validation', () => {
  const setupWithImage = () => {
    const store = setup([])
    act(() =>
      store.setState({
        bitmap: { width: 100, height: 100 } as ImageBitmap,
        imageRect: { x: 0, y: 0, width: 100, height: 100 }
      })
    )
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )
    return store
  }

  it('creates a box that starts inside the image and is large enough', async () => {
    const store = setupWithImage()

    await act(async () => {
      store.setState({ mousePos: [10, 10] })
      store.getState().setMode(LabelerMode.CreateBox)
      store.getState().onConfirmPoint(60, 60)
      store.getState().onConfirmPoint(60, 60)
      await flush()
    })

    expect(Object.keys(store.getState().sample!.resolve().annotations.resolve())).toHaveLength(1)
  })

  it('discards a box whose corners were both clicked outside the image', async () => {
    const store = setupWithImage()

    await act(async () => {
      store.setState({ mousePos: [-10, -10] })
      store.getState().setMode(LabelerMode.CreateBox)
      store.getState().onConfirmPoint(-20, -20)
      store.getState().onConfirmPoint(-20, -20)
      await flush()
    })

    expect(Object.keys(store.getState().sample!.resolve().annotations.resolve())).toHaveLength(0)
  })

  it('discards a box too small on screen to be an intentional drag', async () => {
    const store = setupWithImage()

    await act(async () => {
      store.setState({ mousePos: [50, 50] })
      store.getState().setMode(LabelerMode.CreateBox)
      store.getState().onConfirmPoint(51, 51)
      store.getState().onConfirmPoint(51, 51)
      await flush()
    })

    expect(Object.keys(store.getState().sample!.resolve().annotations.resolve())).toHaveLength(0)
  })
})

describe('useLabeler duplicateAnnotation', () => {
  it('creates an offset copy and selects it', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )

    let newId: string | undefined
    await act(async () => {
      newId = store.getState().duplicateAnnotation('a1')
      await flush()
    })

    expect(newId).toBeDefined()
    expect(newId).not.toBe('a1')

    const annotations = store.getState().sample!.resolve().annotations.resolve()
    expect(Object.keys(annotations)).toHaveLength(2)

    const duplicate = annotations[newId!].resolve()
    expect(duplicate.labelId).toBe(annotationA.labelId)
    expect(duplicate.type).toBe(annotationA.type)
    // Offset the same way on both points - same shape, just translated.
    expect(duplicate.points[0].x).toBeGreaterThan(annotationA.points[0].x)
    expect(duplicate.points[0].y).toBeGreaterThan(annotationA.points[0].y)
    expect(duplicate.points[1].x - duplicate.points[0].x).toBeCloseTo(
      annotationA.points[1].x - annotationA.points[0].x
    )

    expect(store.getState().selectedAnnotation?.resolve().id).toBe(newId)
  })

  it('undoes a duplicate, removing the copy and leaving the original untouched', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )
    vi.mocked(dataStore.deleteAnnotations).mockResolvedValue([true])

    let newId: string | undefined
    await act(async () => {
      newId = store.getState().duplicateAnnotation('a1')
      await flush()
    })

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    const annotations = store.getState().sample!.resolve().annotations.resolve()
    expect(annotations[newId!]).toBeUndefined()
    expect(annotations.a1).toBeDefined()
    expect(dataStore.deleteAnnotations).toHaveBeenCalledWith([newId])
  })

  it('offsets away from the image edge when the default direction has no room', async () => {
    const nearEdge: IAnnotation = {
      id: 'a4',
      type: AnnotationType.Box,
      labelId: 'l1',
      points: [
        { id: 'p1', x: 90, y: 90 },
        { id: 'p2', x: 100, y: 100 }
      ]
    }
    const store = setup([nearEdge])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )
    act(() => store.setState({ bitmap: { width: 100, height: 100 } as ImageBitmap }))

    let newId: string | undefined
    await act(async () => {
      newId = store.getState().duplicateAnnotation('a4')
      await flush()
    })

    const duplicate = store.getState().sample!.resolve().annotations.resolve()[newId!].resolve()
    // No room to the right/bottom - the box already touches the 100x100 image's edge -
    // so it offsets left/up instead, but is still a pure translation (same shape).
    expect(duplicate.points[0].x).toBeLessThan(nearEdge.points[0].x)
    expect(duplicate.points[0].y).toBeLessThan(nearEdge.points[0].y)
    expect(duplicate.points[1].x - duplicate.points[0].x).toBeCloseTo(
      nearEdge.points[1].x - nearEdge.points[0].x
    )
    for (const p of duplicate.points) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(100)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(100)
    }
  })

  it('shrinks the offset rather than placing the duplicate outside the image when neither side has room', async () => {
    const fullImage: IAnnotation = {
      id: 'a5',
      type: AnnotationType.Box,
      labelId: 'l1',
      points: [
        { id: 'p1', x: 0, y: 0 },
        { id: 'p2', x: 100, y: 100 }
      ]
    }
    const store = setup([fullImage])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.createAnnotations).mockImplementation(
      async (_sampleId, annotations) => annotations
    )
    act(() => store.setState({ bitmap: { width: 100, height: 100 } as ImageBitmap }))

    let newId: string | undefined
    await act(async () => {
      newId = store.getState().duplicateAnnotation('a5')
      await flush()
    })

    const duplicate = store.getState().sample!.resolve().annotations.resolve()[newId!].resolve()
    for (const p of duplicate.points) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(100)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(100)
    }
  })
})

describe('useLabeler convertAnnotationType', () => {
  it('converts a box to a 4-point polygon and back', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.updateAnnotations).mockImplementation(async (updates) =>
      updates.map((u) => ({ ...annotationA, ...u }))
    )
    vi.mocked(dataStore.replacePoints).mockImplementation(async (_id, points) =>
      (points as IPoint[]).map((p) => ({ id: p.id, x: p.x, y: p.y }))
    )

    await act(async () => {
      store.getState().convertAnnotationType('a1')
      await flush()
    })

    const converted = store.getState().sample!.resolve().annotations.resolve().a1.resolve()
    expect(converted.type).toBe(AnnotationType.Polygon)
    expect(converted.points).toHaveLength(4)

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    const restored = store.getState().sample!.resolve().annotations.resolve().a1.resolve()
    expect(restored.type).toBe(AnnotationType.Box)
    expect(restored.points.map((p) => [p.x, p.y])).toEqual(
      annotationA.points.map((p) => [p.x, p.y])
    )
  })

  it('converts a polygon to its bounding box', async () => {
    const triangle: IAnnotation = {
      id: 'a3',
      type: AnnotationType.Polygon,
      labelId: 'l1',
      points: [
        { id: 'p1', x: 0, y: 0 },
        { id: 'p2', x: 20, y: 0 },
        { id: 'p3', x: 10, y: 10 }
      ]
    }
    const store = setup([triangle])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.updateAnnotations).mockImplementation(async (updates) =>
      updates.map((u) => ({ ...triangle, ...u }))
    )
    vi.mocked(dataStore.replacePoints).mockImplementation(async (_id, points) =>
      (points as IPoint[]).map((p) => ({ id: p.id, x: p.x, y: p.y }))
    )

    await act(async () => {
      store.getState().convertAnnotationType('a3')
      await flush()
    })

    const converted = store.getState().sample!.resolve().annotations.resolve().a3.resolve()
    expect(converted.type).toBe(AnnotationType.Box)
    expect(converted.points.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [20, 10]
    ])
  })
})

describe('useLabeler selected annotation hit ids', () => {
  it("keeps a Box's corner/edge sentinel hit ids selectable after a move", async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.replacePoints).mockImplementation(async (_id, points) =>
      (points as IPoint[]).map((p) => ({ id: p.id, x: p.x, y: p.y }))
    )

    act(() => {
      store.getState().selectAnnotation('a1')
      store.getState().moveSelectedAnnotationBy(5, 5)
    })
    await act(async () => {
      store.getState().commitAnnotationMove('a1')
      await flush()
    })

    expect(
      store.getState().selectedAnnotationControlHitIds.getByValue(BOX_CORNER_HANDLE_TOP_RIGHT)
    ).toBeDefined()
    expect(
      store.getState().selectedAnnotationControlHitIds.getByValue(BOX_CORNER_HANDLE_BOTTOM_LEFT)
    ).toBeDefined()
    expect(store.getState().selectedAnnotationLineHitIds.getByValue(BOX_EDGE_TOP)).toBeDefined()
    expect(store.getState().selectedAnnotationLineHitIds.getByValue(BOX_EDGE_RIGHT)).toBeDefined()
    expect(store.getState().selectedAnnotationLineHitIds.getByValue(BOX_EDGE_BOTTOM)).toBeDefined()
    expect(store.getState().selectedAnnotationLineHitIds.getByValue(BOX_EDGE_LEFT)).toBeDefined()
  })
})

describe('useLabeler label picker sync', () => {
  it('switches selectedLabelId to match the clicked annotation', () => {
    const store = setup([annotationA])
    act(() => store.getState().setLabelId('l2'))
    expect(store.getState().selectedLabelId).toBe('l2')

    act(() => store.getState().selectAnnotation('a1'))

    expect(store.getState().selectedLabelId).toBe('l1')
  })

  it('leaves selectedLabelId alone when deselecting', () => {
    const store = setup([annotationA])
    act(() => {
      store.getState().setLabelId('l2')
      store.getState().selectAnnotation('a1')
    })
    expect(store.getState().selectedLabelId).toBe('l1')

    act(() => store.getState().selectAnnotation(null))

    expect(store.getState().selectedLabelId).toBe('l1')
  })

  it('keeps selectedLabelId in sync when the selected annotation is relabeled, including via undo', async () => {
    const store = setup([annotationA])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.updateAnnotations).mockImplementation(async (updates) =>
      updates.map((u) => ({ ...annotationA, ...u }))
    )

    act(() => store.getState().selectAnnotation('a1'))
    expect(store.getState().selectedLabelId).toBe('l1')

    await act(async () => {
      store.getState().setAnnotationLabelId('a1', 'l2')
      await flush()
    })

    expect(store.getState().selectedLabelId).toBe('l2')

    await act(async () => {
      store.getState().undo()
      await flush()
    })

    expect(store.getState().selectedLabelId).toBe('l1')
  })

  it('does not change selectedLabelId when relabeling an annotation that is not selected', async () => {
    const store = setup([annotationA, annotationB])
    const dataStore = useAppStore.getState().store
    vi.mocked(dataStore.updateAnnotations).mockImplementation(async (updates) =>
      updates.map((u) => ({ ...annotationB, ...u }))
    )

    act(() => store.getState().selectAnnotation('a1'))
    expect(store.getState().selectedLabelId).toBe('l1')

    await act(async () => {
      store.getState().setAnnotationLabelId('a2', 'l2')
      await flush()
    })

    expect(store.getState().selectedLabelId).toBe('l1')
  })
})

describe('useLabeler cancelActiveAction', () => {
  it('deselects the current annotation, leaving the mode alone', () => {
    const store = setup([annotationA])
    act(() => {
      store.getState().setMode(LabelerMode.Select)
      store.getState().selectAnnotation('a1')
    })

    act(() => store.getState().cancelActiveAction())

    expect(store.getState().selectedAnnotation).toBeNull()
    expect(store.getState().mode).toBe(LabelerMode.Select)
  })

  it('drops out of a create mode back to Select when nothing is selected', () => {
    const store = setup([])
    act(() => store.getState().setMode(LabelerMode.CreatePolygon))

    act(() => store.getState().cancelActiveAction())

    expect(store.getState().mode).toBe(LabelerMode.Select)
    expect(store.getState().annotationBeingCreated).toBeNull()
  })

  it('is a no-op in Select mode with nothing selected', () => {
    const store = setup([])
    act(() => store.getState().setMode(LabelerMode.Select))

    act(() => store.getState().cancelActiveAction())

    expect(store.getState().mode).toBe(LabelerMode.Select)
    expect(store.getState().selectedAnnotation).toBeNull()
  })
})
