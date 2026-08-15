import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AnnotationType, IProject, ISample, ITask, TrainingSplit } from '@shared/types'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

const { back } = vi.hoisted(() => ({ back: vi.fn() }))

vi.mock('@renderer/router/appRouter', () => ({
  navigate: vi.fn(),
  back
}))

import { useAppStore } from '@renderer/hooks/useAppStore'
import { CopyAnnotationsPage } from '../CopyAnnotationsPage'

const project: IProject = {
  id: 'p1',
  name: 'Docs',
  labels: [{ id: 'l1', name: 'Text', color: '#fff' }]
}
const sourceTask: ITask = { id: 'src', name: 'English' }
const destinationTask: ITask = { id: 'dst', name: 'French' }
const otherDestinationTask: ITask = { id: 'dst2', name: 'German' }

const makeSample = (overrides: Partial<ISample> & Pick<ISample, 'id' | 'name'>): ISample => ({
  imageUri: `cv-label-image://${overrides.id}`,
  split: TrainingSplit.Train,
  width: 100,
  height: 100,
  annotations: [],
  completedAt: null,
  createdAt: new Date().toISOString(),
  ...overrides
})

const annotated = (id: string) => [
  {
    id: `a-${id}`,
    type: AnnotationType.Box,
    labelId: 'l1',
    points: [{ id: `p-${id}`, x: 1, y: 1 }]
  }
]

const renderPage = () =>
  renderWithProviders(<CopyAnnotationsPage project={project} sourceTask={sourceTask} />)

const pickDestinationAndContinue = async (name: string) => {
  fireEvent.click(await screen.findByPlaceholderText('Select a task'))
  fireEvent.click(await screen.findByText(name))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('button', { name: 'Run' })
}

beforeEach(() => {
  back.mockReset()
  vi.mocked(useAppStore.getState().store.getTasksForProject)
    .mockReset()
    .mockResolvedValue([sourceTask, destinationTask, otherDestinationTask])
  vi.mocked(useAppStore.getState().store.getSamplesForTask)
    .mockReset()
    .mockImplementation((taskId) => {
      if (taskId === sourceTask.id) {
        return Promise.resolve([
          makeSample({ id: 's1', name: 'sample-1', annotations: annotated('s1') }),
          makeSample({ id: 's2', name: 'sample-2', annotations: annotated('s2') })
        ])
      }
      if (taskId === destinationTask.id) {
        return Promise.resolve([
          makeSample({ id: 'd1', name: 'dest-1' }),
          makeSample({ id: 'd2', name: 'dest-2' })
        ])
      }
      return Promise.resolve([])
    })
  vi.mocked(useAppStore.getState().store.createAnnotations).mockReset().mockResolvedValue([])
})

describe('CopyAnnotationsPage', () => {
  it('shows the destination picker once source samples load', async () => {
    renderPage()

    expect(await screen.findByPlaceholderText('Select a task')).toBeInTheDocument()
  })

  it('shows an empty state when the source task has no samples', async () => {
    vi.mocked(useAppStore.getState().store.getSamplesForTask).mockImplementation((taskId) =>
      Promise.resolve(taskId === sourceTask.id ? [] : [])
    )
    renderPage()

    expect(
      await screen.findByText('"English" has no samples to copy annotations from.')
    ).toBeInTheDocument()
  })

  it('shows an empty state when the project has no other tasks', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([sourceTask])
    renderPage()

    expect(
      await screen.findByText(
        'This project has no other tasks yet - create one with the matching pages first.'
      )
    ).toBeInTheDocument()
  })

  it('copies annotations by default position mapping and reports a summary', async () => {
    renderPage()
    await pickDestinationAndContinue('French')

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())
    expect(useAppStore.getState().store.createAnnotations).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState().store.createAnnotations).toHaveBeenCalledWith(
      'd1',
      expect.arrayContaining([expect.objectContaining({ labelId: 'l1' })])
    )
    expect(useAppStore.getState().store.createAnnotations).toHaveBeenCalledWith(
      'd2',
      expect.arrayContaining([expect.objectContaining({ labelId: 'l1' })])
    )
    expect(screen.getByText(/2 annotations copied, across 2 samples/)).toBeInTheDocument()
  })

  it('skips a destination sample that already has an annotation', async () => {
    vi.mocked(useAppStore.getState().store.getSamplesForTask).mockImplementation((taskId) => {
      if (taskId === sourceTask.id) {
        return Promise.resolve([
          makeSample({ id: 's1', name: 'sample-1', annotations: annotated('s1') })
        ])
      }
      if (taskId === destinationTask.id) {
        return Promise.resolve([
          makeSample({ id: 'd1', name: 'dest-1', annotations: annotated('d1') })
        ])
      }
      return Promise.resolve([])
    })
    renderPage()
    await pickDestinationAndContinue('French')

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())
    expect(useAppStore.getState().store.createAnnotations).not.toHaveBeenCalled()
    expect(screen.getByText(/1 already labeled/)).toBeInTheDocument()
  })

  it('skips a pair whose source and destination dimensions differ', async () => {
    vi.mocked(useAppStore.getState().store.getSamplesForTask).mockImplementation((taskId) => {
      if (taskId === sourceTask.id) {
        return Promise.resolve([
          makeSample({ id: 's1', name: 'sample-1', annotations: annotated('s1') })
        ])
      }
      if (taskId === destinationTask.id) {
        return Promise.resolve([makeSample({ id: 'd1', name: 'dest-1', width: 200, height: 200 })])
      }
      return Promise.resolve([])
    })
    renderPage()
    await pickDestinationAndContinue('French')

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())
    expect(useAppStore.getState().store.createAnnotations).not.toHaveBeenCalled()
    expect(screen.getByText(/1 size mismatch/)).toBeInTheDocument()
  })

  it('warns and only copies once when two rows are mapped to the same destination', async () => {
    vi.mocked(useAppStore.getState().store.getSamplesForTask).mockImplementation((taskId) => {
      if (taskId === sourceTask.id) {
        return Promise.resolve([
          makeSample({ id: 's1', name: 'sample-1', annotations: annotated('s1') }),
          makeSample({ id: 's2', name: 'sample-2', annotations: annotated('s2') })
        ])
      }
      if (taskId === destinationTask.id) {
        return Promise.resolve([makeSample({ id: 'd1', name: 'dest-1' })])
      }
      return Promise.resolve([])
    })
    renderPage()
    await pickDestinationAndContinue('French')

    // sample-2's row defaults to Skip (only one destination sample exists) - remap it onto
    // the same destination sample-1 already uses.
    fireEvent.click(screen.getByDisplayValue('Skip'))
    fireEvent.click(await screen.findByRole('option', { name: 'dest-1' }))

    expect(
      screen.getByText('Also mapped from another sample - only the first copy will run.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())
    expect(useAppStore.getState().store.createAnnotations).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/1 duplicate mapping/)).toBeInTheDocument()
  })

  it('isolates a per-pair failure without stopping the rest of the run', async () => {
    vi.mocked(useAppStore.getState().store.createAnnotations).mockImplementation((sampleId) =>
      sampleId === 'd1' ? Promise.reject(new Error('boom')) : Promise.resolve([])
    )
    renderPage()
    await pickDestinationAndContinue('French')

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())
    expect(screen.getByText(/1 failed/)).toBeInTheDocument()
    expect(screen.getByText(/dest-1: boom/)).toBeInTheDocument()
  })

  it('returns to the destination picker after Done, for a repeat run', async () => {
    renderPage()
    await pickDestinationAndContinue('French')
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(await screen.findByPlaceholderText('Select a task')).toBeInTheDocument()
  })

  it('calls the router back() from the top-bar Back button', async () => {
    renderPage()
    await screen.findByPlaceholderText('Select a task')

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(back).toHaveBeenCalledTimes(1)
  })
})
