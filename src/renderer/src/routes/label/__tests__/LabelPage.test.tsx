import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, ITask } from '@shared/types'
import { LabelerMode, OptimisticSample } from '@renderer/types'
import { create } from 'zustand'

const setSample = vi.fn()
const setMode = vi.fn()
const setLabelId = vi.fn()
const selectAnnotation = vi.fn()
const deleteAnnotation = vi.fn()
const setHoveredAnnotation = vi.fn()
const setAnnotationsDrawerHovered = vi.fn()
const markAllDirty = vi.fn()
const cancelPendingSampleLoad = vi.fn()

vi.mock('@renderer/components/Labeler', () => ({
  Labeler: () => <div data-testid="labeler-stub" />
}))

vi.mock('@renderer/hooks/useLabeler', () => ({
  useLabeler: (labels: { id: string }[]) => ({
    store: create(() => ({
      mode: LabelerMode.Select,
      selectedLabelId: labels[0]?.id ?? '',
      sample: {
        resolve: () => ({
          id: 'sample-1',
          completedAt: null,
          annotations: { resolve: () => ({}) }
        })
      },
      selectedAnnotation: null,
      labelsMap: {},
      setSample,
      setMode,
      setLabelId,
      selectAnnotation,
      deleteAnnotation,
      setHoveredAnnotation,
      setAnnotationsDrawerHovered,
      markAllDirty,
      cancelPendingSampleLoad
    }))
  })
}))

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

// A Set, not a single ref: LabelPage and the AnnotationsDrawer it renders each register
// their own useOnRouteLeave callback, so a single "last one wins" slot would let the
// drawer's registration clobber the page's.
const { onRouteEnterCallbacks, onRouteLeaveCallbacks } = vi.hoisted(() => ({
  onRouteEnterCallbacks: new Set<() => void>(),
  onRouteLeaveCallbacks: new Set<() => void>()
}))

vi.mock('@renderer/router/appRouter', () => ({
  navigate: vi.fn(),
  back: vi.fn(),
  useOnRouteEnter: (callback: () => void) => {
    onRouteEnterCallbacks.add(callback)
  },
  useOnRouteLeave: (callback: () => void) => {
    onRouteLeaveCallbacks.add(callback)
  }
}))

const fireRouteEnter = () => onRouteEnterCallbacks.forEach((callback) => callback())
const fireRouteLeave = () => onRouteLeaveCallbacks.forEach((callback) => callback())

import { LabelPage } from '../LabelPage'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [
    { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
    { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
  ]
}
const task: ITask = { id: 't1', name: 'Batch 1' }
const fakeSamples = [
  { resolve: () => ({ id: 'sample-1' }) },
  { resolve: () => ({ id: 'sample-2' }) }
] as unknown as OptimisticSample[]

const renderLabelPage = (projectOverride: IProject = project) =>
  renderWithProviders(
    <LabelPage project={projectOverride} task={task} samples={fakeSamples} initial={0} />
  )

beforeEach(() => {
  setSample.mockClear()
  setMode.mockClear()
  setLabelId.mockClear()
  setHoveredAnnotation.mockClear()
  setAnnotationsDrawerHovered.mockClear()
  markAllDirty.mockClear()
  cancelPendingSampleLoad.mockClear()
  onRouteEnterCallbacks.clear()
  onRouteLeaveCallbacks.clear()
})

describe('LabelPage', () => {
  it('renders the (mocked) labeler and loads the initial sample', () => {
    renderLabelPage()

    expect(screen.getByTestId('labeler-stub')).toBeInTheDocument()
    expect(setSample).toHaveBeenCalledWith(fakeSamples[0])
  })

  it('shows the label picker when the project has more than one label', () => {
    renderLabelPage()

    expect(screen.getByText('Stop Sign')).toBeInTheDocument()
    expect(screen.getByText('Yield Sign')).toBeInTheDocument()
  })

  it('hides the label picker when the project only has one label', () => {
    renderLabelPage({
      id: 'p2',
      name: 'Single Label Project',
      labels: [{ id: 'l1', name: 'Only Label', color: '#ff0000' }]
    })

    expect(screen.queryByText('Only Label')).not.toBeInTheDocument()
  })

  it('keeps the label picker in a width-bounded scroll container so it does not grow unbounded', () => {
    const manyLabels = Array.from({ length: 15 }, (_, i) => ({
      id: `l${i}`,
      name: `Label ${i}`,
      color: '#ff0000'
    }))
    renderLabelPage({ id: 'p3', name: 'Many Labels Project', labels: manyLabels })

    for (const label of manyLabels) {
      expect(screen.getByText(label.name)).toBeInTheDocument()
    }

    const scrollArea = screen.getByTestId('label-scroll-area')
    expect(scrollArea.style.maxWidth).toBeTruthy()
  })

  it('shows a button reflecting the current sample completion state', () => {
    renderLabelPage()

    expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument()
  })

  it('opens the annotations drawer when the toggle button is clicked', async () => {
    renderLabelPage()

    expect(screen.queryByText('No annotations yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Annotations' }))

    expect(await screen.findByText('No annotations yet')).toBeInTheDocument()
  })

  it('forces a full repaint when the router reports this page becoming visible again', () => {
    renderLabelPage()
    markAllDirty.mockClear()

    fireRouteEnter()

    expect(markAllDirty).toHaveBeenCalled()
  })

  it('cancels an in-flight sample load when the router reports leaving the page', () => {
    renderLabelPage()

    fireRouteLeave()

    expect(cancelPendingSampleLoad).toHaveBeenCalled()
  })
})
