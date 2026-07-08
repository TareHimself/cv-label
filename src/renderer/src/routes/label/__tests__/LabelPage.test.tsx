import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, ITask } from '@shared/types'
import { LabelerMode } from '@renderer/types'
import { create } from 'zustand'

const setSample = vi.fn()
const setMode = vi.fn()
const setLabelId = vi.fn()

vi.mock('@renderer/components/Labeler', () => ({
  Labeler: () => <div data-testid="labeler-stub" />
}))

vi.mock('@renderer/hooks/useLabeler', () => ({
  useLabeler: (labels: { id: string }[]) => ({
    store: create(() => ({
      mode: LabelerMode.Select,
      selectedLabelId: labels[0]?.id ?? '',
      sample: {
        resolve: () => ({ id: 'sample-1', completedAt: null })
      },
      setSample,
      setMode,
      setLabelId
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
]

const renderLabelPage = (projectOverride: IProject = project) =>
  renderWithProviders(<LabelPage />, {
    routerProps: {
      initialEntries: [
        {
          pathname: '/label/t1',
          state: { project: projectOverride, task, samples: fakeSamples, initial: 0 }
        }
      ]
    }
  })

beforeEach(() => {
  setSample.mockClear()
  setMode.mockClear()
  setLabelId.mockClear()
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

  it('shows the completed toggle for the current sample', () => {
    renderLabelPage()

    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
})
