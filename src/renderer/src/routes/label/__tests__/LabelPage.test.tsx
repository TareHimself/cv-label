import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, ITask, TrainingSplit } from '@shared/types'
import { LabelerMode, OptimisticSample } from '@renderer/types'
import { toOptimisticSample } from '@renderer/util/toOptimisticSample'
import { create } from 'zustand'

const setSample = vi.fn()
const setMode = vi.fn()
const setLabelId = vi.fn()
const selectAnnotation = vi.fn()
const deleteAnnotation = vi.fn()
const deleteSelectedAnnotation = vi.fn()
const cancelActiveAction = vi.fn()
const setHoveredAnnotation = vi.fn()
const setAnnotationsDrawerHovered = vi.fn()
const markAllDirty = vi.fn()
const cancelPendingSampleLoad = vi.fn()

// Overridden per-test to control what store.getState().selectedAnnotation is at mount -
// the mock store below isn't memoized like the real useLabeler, so this is read fresh
// each render rather than settable via store.setState from a test.
let mockSelectedAnnotation: { resolve: () => { id: string } } | null = null

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
      selectedAnnotation: mockSelectedAnnotation,
      labelsMap: {},
      setSample,
      setMode,
      setLabelId,
      selectAnnotation,
      deleteAnnotation,
      deleteSelectedAnnotation,
      cancelActiveAction,
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
import { useAppStore } from '@renderer/hooks/useAppStore'
import { createMockDataStore } from '@renderer/__tests__/mockDataStore'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [
    { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
    { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
  ]
}
const task: ITask = { id: 't1', name: 'Batch 1' }
const makeFakeSample = (id: string) =>
  toOptimisticSample({
    id,
    name: id,
    split: TrainingSplit.Train,
    createdAt: new Date().toISOString(),
    imageUri: 'about:blank',
    width: 100,
    height: 100,
    completedAt: null,
    annotations: []
  })
// Reassigned fresh in beforeEach: each sample is a real OptimisticObject that
// accumulates update() diffs, so reusing one instance across tests would leak the
// completion toggle from one test's assertions into the next.
let fakeSamples: OptimisticSample[]

const renderLabelPage = (projectOverride: IProject = project) =>
  renderWithProviders(
    <LabelPage project={projectOverride} task={task} samples={fakeSamples} initial={0} />
  )

beforeEach(() => {
  setSample.mockClear()
  setMode.mockClear()
  setLabelId.mockClear()
  deleteSelectedAnnotation.mockClear()
  cancelActiveAction.mockClear()
  setHoveredAnnotation.mockClear()
  setAnnotationsDrawerHovered.mockClear()
  markAllDirty.mockClear()
  cancelPendingSampleLoad.mockClear()
  onRouteEnterCallbacks.clear()
  onRouteLeaveCallbacks.clear()
  mockSelectedAnnotation = null
  fakeSamples = [makeFakeSample('sample-1'), makeFakeSample('sample-2')]
  Object.assign(useAppStore.getState().store, createMockDataStore())
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

  describe('keyboard shortcuts', () => {
    it('switches mode via 1/2/3', () => {
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: '2' })
      expect(setMode).toHaveBeenCalledWith(LabelerMode.CreateBox)

      fireEvent.keyDown(document.documentElement, { key: '3' })
      expect(setMode).toHaveBeenCalledWith(LabelerMode.CreatePolygon)

      fireEvent.keyDown(document.documentElement, { key: '1' })
      expect(setMode).toHaveBeenCalledWith(LabelerMode.Select)
    })

    it('navigates to the next/previous sample with arrow keys, wrapping around', () => {
      renderLabelPage()
      setSample.mockClear()

      fireEvent.keyDown(document.documentElement, { key: 'ArrowRight' })
      expect(setSample).toHaveBeenCalledWith(fakeSamples[1])

      setSample.mockClear()
      fireEvent.keyDown(document.documentElement, { key: 'ArrowLeft' })
      expect(setSample).toHaveBeenCalledWith(fakeSamples[0])
    })

    it('navigates to the next/previous sample with the mouse back/forward buttons, wrapping around', () => {
      renderLabelPage()
      setSample.mockClear()

      fireEvent.mouseDown(document.documentElement, { button: 4 })
      expect(setSample).toHaveBeenCalledWith(fakeSamples[1])

      setSample.mockClear()
      fireEvent.mouseDown(document.documentElement, { button: 3 })
      expect(setSample).toHaveBeenCalledWith(fakeSamples[0])
    })

    it('ignores other mouse buttons', () => {
      renderLabelPage()
      setSample.mockClear()

      fireEvent.mouseDown(document.documentElement, { button: 0 })
      fireEvent.mouseDown(document.documentElement, { button: 1 })
      fireEvent.mouseDown(document.documentElement, { button: 2 })

      expect(setSample).not.toHaveBeenCalled()
    })

    it('ignores the mouse back/forward buttons while the delete confirmation is open', async () => {
      mockSelectedAnnotation = { resolve: () => ({ id: 'a1' }) }
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Delete' })
      await screen.findByText('Delete annotation')
      setSample.mockClear()

      fireEvent.mouseDown(document.documentElement, { button: 4 })

      expect(setSample).not.toHaveBeenCalled()
    })

    it('toggles sample completion via spacebar', async () => {
      renderLabelPage()
      const dataStore = useAppStore.getState().store

      fireEvent.keyDown(document.documentElement, { key: ' ' })

      await waitFor(() =>
        expect(dataStore.updateSamples).toHaveBeenCalledWith([
          { id: 'sample-1', completedAt: expect.any(String) }
        ])
      )
    })

    it('deselects via Escape', () => {
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Escape' })

      expect(cancelActiveAction).toHaveBeenCalledTimes(1)
    })

    it('does nothing on Delete/Backspace when no annotation is selected', () => {
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Delete' })
      fireEvent.keyDown(document.documentElement, { key: 'Backspace' })

      expect(screen.queryByText('Delete annotation')).not.toBeInTheDocument()
    })

    it('asks for confirmation before deleting the selected annotation via Delete, then deletes on confirm', async () => {
      mockSelectedAnnotation = { resolve: () => ({ id: 'a1' }) }
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Delete' })
      expect(await screen.findByText('Delete annotation')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      expect(deleteSelectedAnnotation).toHaveBeenCalledTimes(1)
    })

    it('also opens the delete confirmation via Backspace', async () => {
      mockSelectedAnnotation = { resolve: () => ({ id: 'a1' }) }
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Backspace' })

      expect(await screen.findByText('Delete annotation')).toBeInTheDocument()
    })

    it('does not delete when the confirmation is cancelled', async () => {
      mockSelectedAnnotation = { resolve: () => ({ id: 'a1' }) }
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Delete' })
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

      expect(deleteSelectedAnnotation).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByText('Delete annotation')).not.toBeInTheDocument())
    })

    it('does not deselect via Escape while the delete confirmation is open', () => {
      mockSelectedAnnotation = { resolve: () => ({ id: 'a1' }) }
      renderLabelPage()

      fireEvent.keyDown(document.documentElement, { key: 'Delete' })
      fireEvent.keyDown(document.documentElement, { key: 'Escape' })

      expect(cancelActiveAction).not.toHaveBeenCalled()
    })
  })
})
