import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { LabelerStore } from '@renderer/hooks/useLabeler'
import { LabelerMode } from '@renderer/types'
import { AnnotationType, IAnnotation, ILabel } from '@shared/types'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
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

const maskAnnotation: IAnnotation = {
  id: 'a2',
  type: AnnotationType.Mask,
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
    deleteAnnotation
  })) as unknown as UseBoundStore<StoreApi<LabelerStore>>

beforeEach(() => {
  setMode.mockClear()
  selectAnnotation.mockClear()
  deleteAnnotation.mockClear()
})

describe('AnnotationsDrawer', () => {
  it('shows an empty state when the sample has no annotations', () => {
    renderWithProviders(<AnnotationsDrawer store={makeStore([])} opened onClose={vi.fn()} />)

    expect(screen.getByText('No annotations yet')).toBeInTheDocument()
  })

  it('lists each annotation with its label name', () => {
    renderWithProviders(
      <AnnotationsDrawer
        store={makeStore([boxAnnotation, maskAnnotation])}
        opened
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Stop Sign')).toBeInTheDocument()
    expect(screen.getByText('Yield Sign')).toBeInTheDocument()
  })

  it('selects an annotation when its row is clicked, without changing mode if already in Select', () => {
    renderWithProviders(
      <AnnotationsDrawer
        store={makeStore([boxAnnotation], LabelerMode.Select)}
        opened
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Stop Sign'))

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

    fireEvent.click(screen.getByText('Stop Sign'))

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
})
