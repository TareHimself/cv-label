import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, ITask } from '@shared/types'

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
import { TasksPage } from '../TasksPage'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }
const tasks: ITask[] = [
  { id: 't1', name: 'Batch 1' },
  { id: 't2', name: 'Batch 2' }
]

const renderTasksPage = () => renderWithProviders(<TasksPage project={project} />)

beforeEach(() => {
  vi.mocked(navigate).mockReset()
  vi.mocked(useAppStore.getState().store.getTasksForProject).mockReset().mockResolvedValue(tasks)
})

describe('TasksPage', () => {
  it('shows an empty state while no tasks exist', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([])
    renderTasksPage()

    expect(await screen.findByText('No tasks yet, create one to get started.')).toBeInTheDocument()
  })

  it('lists the tasks for the current project', async () => {
    renderTasksPage()

    expect(await screen.findByText('Batch 1')).toBeInTheDocument()
    expect(screen.getByText('Batch 2')).toBeInTheDocument()
  })

  it('filters the list via the search box', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: '2' } })

    expect(screen.queryByText('Batch 1')).not.toBeInTheDocument()
    expect(screen.getByText('Batch 2')).toBeInTheDocument()
  })

  it('navigates to samples when a task is clicked', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByText('Batch 1'))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('samples', { project, task: tasks[0] })
    })
  })

  it('deletes a task after confirming', async () => {
    vi.mocked(useAppStore.getState().store.deleteTasks).mockResolvedValue([true])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Delete'))

    const dialogDeleteButton = await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(dialogDeleteButton)

    await waitFor(() => {
      expect(useAppStore.getState().store.deleteTasks).toHaveBeenCalledWith(['t1'])
    })
  })
})
