import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('renames a task via the context menu', async () => {
    vi.mocked(useAppStore.getState().store.updateTasks).mockResolvedValue([
      { id: 't1', name: 'Batch 1 Renamed' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Edit'))

    const dialog = await screen.findByRole('dialog', { name: 'Rename task' })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Batch 1 Renamed' }
    })
    // The mutation settling triggers a refetch - point it at the post-rename state too, so
    // it doesn't revert the optimistic update back to the stale name once it lands.
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1 Renamed' },
      tasks[1]
    ])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.updateTasks).toHaveBeenCalledWith([
        { id: 't1', name: 'Batch 1 Renamed' }
      ])
    })
    expect(await screen.findByText('Batch 1 Renamed')).toBeInTheDocument()
  })

  it('keeps a selected task visible even when it no longer matches the search', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: '2' } })

    expect(screen.getByText('Batch 1')).toBeInTheDocument()
    expect(screen.getByText('Batch 2')).toBeInTheDocument()
  })

  it('only shows checkboxes and toggles select-by-click after entering select mode via the Select button', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Batch 1'))

    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeChecked()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('Clear exits select mode entirely, hiding checkboxes again', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('right-click Select All selects every currently visible (filtered) task', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      ...tasks,
      { id: 't3', name: 'Other' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    // Filter down to only the "Batch" tasks before selecting all.
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'Batch' } })
    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Select All'))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Batch 2' })).toBeChecked()
  })

  it('right-click Select Above/Below selects a range within the currently visible list', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Alpha' },
      { id: 't2', name: 'Beta' },
      { id: 't3', name: 'Gamma' }
    ])
    renderTasksPage()
    await screen.findByText('Alpha')

    fireEvent.contextMenu(screen.getByText('Beta'))
    fireEvent.click(screen.getByText('Select Above'))

    expect(screen.getByRole('checkbox', { name: 'Select Alpha' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Beta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Gamma' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.contextMenu(screen.getByText('Beta'))
    fireEvent.click(screen.getByText('Select Below'))

    expect(screen.getByRole('checkbox', { name: 'Select Alpha' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Beta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Gamma' })).toBeChecked()
  })

  it('disables batch Export/Delete while nothing is selected, and enables them once something is', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))

    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
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
