import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { LabelerStore } from '@renderer/hooks/useLabeler'
import { LabelerMode } from '@renderer/types'
import { AnnotationType, IAnnotation, ILabel } from '@shared/types'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

const { onRouteLeave } = vi.hoisted(() => ({
  onRouteLeave: { current: null as (() => void) | null }
}))

vi.mock('@renderer/router/appRouter', () => ({
  navigate: vi.fn(),
  back: vi.fn(),
  useOnRouteLeave: (callback: () => void) => {
    onRouteLeave.current = callback
  }
}))

import { AnnotationsDrawer } from '../AnnotationsDrawer'

const labels: ILabel[] = [
  { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
  { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
]

const boxAnnotation: IAnnotation = {
  id: 'a1',
  type: AnnotationType.Box,
  labelId: 'l1',
  points: [
    { id: 'p0', x: 0, y: 0 },
    { id: 'p1', x: 10, y: 10 }
  ]
}

const secondBoxAnnotation: IAnnotation = {
  id: 'a3',
  type: AnnotationType.Box,
  labelId: 'l1',
  points: [
    { id: 'p4', x: 20, y: 20 },
    { id: 'p5', x: 30, y: 30 }
  ]
}

const polygonAnnotation: IAnnotation = {
  id: 'a2',
  type: AnnotationType.Polygon,
  labelId: 'l2',
  points: [
    { id: 'p2', x: 0, y: 0 },
    { id: 'p3', x: 10, y: 0 },
    { id: 'p4', x: 5, y: 10 }
  ]
}

const setMode = vi.fn()
const selectAnnotation = vi.fn()
const deleteAnnotation = vi.fn()
const setHoveredAnnotation = vi.fn()
const setAnnotationsDrawerHovered = vi.fn()

const makeStore = (
  annotations: IAnnotation[],
  mode: LabelerMode = LabelerMode.Select,
  selectedAnnotationId: string | null = null
) =>
  create(() => ({
    mode,
    sample: {
      resolve: () => ({
        annotations: {
          resolve: () => Object.fromEntries(annotations.map((a) => [a.id, { resolve: () => a }]))
        }
      })
    },
    selectedAnnotation:
      selectedAnnotationId === null
        ? null
        : { resolve: () => annotations.find((a) => a.id === selectedAnnotationId) },
    labelsMap: Object.fromEntries(labels.map((l) => [l.id, l])),
    setMode,
    selectAnnotation,
    deleteAnnotation,
    setHoveredAnnotation,
    setAnnotationsDrawerHovered
  })) as unknown as UseBoundStore<StoreApi<LabelerStore>>

beforeEach(() => {
  setMode.mockClear()
  selectAnnotation.mockClear()
  deleteAnnotation.mockClear()
  setHoveredAnnotation.mockClear()
  setAnnotationsDrawerHovered.mockClear()
  onRouteLeave.current = null
})

describe('AnnotationsDrawer', () => {
  it('shows an empty state when the sample has no annotations', () => {
    renderWithProviders(<AnnotationsDrawer store={makeStore([])} opened onClose={vi.fn()} />)

    expect(screen.getByText('No annotations yet')).toBeInTheDocument()
  })

  it('groups annotations under a header per label, with a count', () => {
    renderWithProviders(
      <AnnotationsDrawer
        store={makeStore([boxAnnotation, secondBoxAnnotation, polygonAnnotation])}
        opened
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Stop Sign')).toBeInTheDocument()
    expect(screen.getByText('Yield Sign')).toBeInTheDocument()
    // 2 Stop Sign annotations, 1 Yield Sign annotation.
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Box 1')).toBeInTheDocument()
    expect(screen.getByText('Box 2')).toBeInTheDocument()
    expect(screen.getByText('Polygon 1')).toBeInTheDocument()
  })

  it('groups an annotation whose label no longer resolves under "Unknown label"', () => {
    const orphan: IAnnotation = { ...boxAnnotation, id: 'a4', labelId: 'deleted-label' }
    renderWithProviders(<AnnotationsDrawer store={makeStore([orphan])} opened onClose={vi.fn()} />)

    expect(screen.getByText('Unknown label')).toBeInTheDocument()
  })

  it('starts with every group expanded, and collapses/expands on header click', () => {
    renderWithProviders(
      <AnnotationsDrawer store={makeStore([boxAnnotation])} opened onClose={vi.fn()} />
    )

    expect(screen.getByText('Box 1')).toBeVisible()

    fireEvent.click(screen.getByText('Stop Sign'))
    expect(screen.getByText('Box 1')).not.toBeVisible()

    fireEvent.click(screen.getByText('Stop Sign'))
    expect(screen.getByText('Box 1')).toBeVisible()
  })

  it('selects an annotation when its row is clicked, without changing mode if already in Select', () => {
    renderWithProviders(
      <AnnotationsDrawer
        store={makeStore([boxAnnotation], LabelerMode.Select)}
        opened
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Box 1'))

    expect(selectAnnotation).toHaveBeenCalledWith('a1')
    expect(setMode).not.toHaveBeenCalled()
  })

  it('switches to Select mode before selecting when in a Create mode', () => {
    renderWithProviders(
      <AnnotationsDrawer
        store={makeStore([boxAnnotation], LabelerMode.CreateBox)}
        opened
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Box 1'))

    expect(setMode).toHaveBeenCalledWith(LabelerMode.Select)
    expect(selectAnnotation).toHaveBeenCalledWith('a1')
  })

  it('deletes an annotation via its delete icon, without selecting it', () => {
    renderWithProviders(
      <AnnotationsDrawer store={makeStore([boxAnnotation])} opened onClose={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete annotation' }))

    expect(deleteAnnotation).toHaveBeenCalledWith('a1')
    expect(selectAnnotation).not.toHaveBeenCalled()
  })

  it('sets the hovered annotation on mouse enter and clears it on mouse leave', () => {
    renderWithProviders(
      <AnnotationsDrawer store={makeStore([boxAnnotation])} opened onClose={vi.fn()} />
    )

    const row = screen.getByText('Box 1')
    fireEvent.mouseEnter(row)
    expect(setHoveredAnnotation).toHaveBeenCalledWith('a1')

    fireEvent.mouseLeave(row)
    expect(setHoveredAnnotation).toHaveBeenLastCalledWith(null)
  })

  it('clears the drawer-hover (and canvas dim) when the drawer closes', () => {
    const store = makeStore([boxAnnotation])
    const { rerender } = renderWithProviders(
      <AnnotationsDrawer store={store} opened onClose={vi.fn()} />
    )
    setAnnotationsDrawerHovered.mockClear()

    rerender(<AnnotationsDrawer store={store} opened={false} onClose={vi.fn()} />)

    expect(setAnnotationsDrawerHovered).toHaveBeenCalledWith(false)
  })

  it('clears the drawer-hover (and canvas dim) when the router reports leaving the label page', () => {
    renderWithProviders(
      <AnnotationsDrawer store={makeStore([boxAnnotation])} opened onClose={vi.fn()} />
    )
    setAnnotationsDrawerHovered.mockClear()

    act(() => onRouteLeave.current?.())

    expect(setAnnotationsDrawerHovered).toHaveBeenCalledWith(false)
  })

  it('marks the drawer as hovered on mouse enter and clears it on mouse leave', () => {
    renderWithProviders(
      <AnnotationsDrawer store={makeStore([boxAnnotation])} opened onClose={vi.fn()} />
    )

    const panel = screen.getByTestId('annotations-drawer-content')

    fireEvent.mouseEnter(panel)
    expect(setAnnotationsDrawerHovered).toHaveBeenCalledWith(true)

    fireEvent.mouseLeave(panel)
    expect(setAnnotationsDrawerHovered).toHaveBeenLastCalledWith(false)
  })
})
