import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, ISample, ITask, TrainingSplit } from '@shared/types'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

vi.mock('@renderer/router/appRouter', () => ({
  navigate: vi.fn(),
  back: vi.fn()
}))

import { useAppStore } from '@renderer/hooks/useAppStore'
import { navigate } from '@renderer/router/appRouter'
import { SamplesPage } from '../SamplesPage'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }
const task: ITask = { id: 't1', name: 'Batch 1' }

const samples: ISample[] = [
  {
    id: 's1',
    name: 'photo-one',
    imageUri: 'cv-label-image://s1',
    split: TrainingSplit.Train,
    annotations: [],
    completedAt: null,
    createdAt: new Date().toISOString()
  },
  {
    id: 's2',
    name: 'photo-two',
    imageUri: 'cv-label-image://s2',
    split: TrainingSplit.Test,
    annotations: [],
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
]

const renderSamplesPage = () => renderWithProviders(<SamplesPage project={project} task={task} />)

beforeEach(() => {
  vi.mocked(navigate).mockReset()
  vi.mocked(useAppStore.getState().store.getSamplesForTask).mockReset().mockResolvedValue(samples)
})

describe('SamplesPage', () => {
  it('lists samples for the task', async () => {
    renderSamplesPage()

    expect(await screen.findByText('photo-one')).toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
  })

  it('navigates to the labeler when Label is clicked', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.click(screen.getAllByRole('button', { name: 'Label' })[0])

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        'label',
        expect.objectContaining({ project, task, initial: 0 })
      )
    })
  })
})
