import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject } from '@shared/types'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

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

import { useAppStore } from '@renderer/hooks/useAppStore'
import { navigate } from '@renderer/router/appRouter'
import { ProjectsPage } from '../ProjectsPage'

const projects: IProject[] = [
  {
    id: 'p1',
    name: 'Street Signs',
    labels: [
      { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
      { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
    ]
  },
  {
    id: 'p2',
    name: 'Wildlife Cams',
    labels: []
  }
]

beforeEach(() => {
  vi.mocked(navigate).mockReset()
  vi.mocked(useAppStore.getState().store.getProjects).mockReset().mockResolvedValue(projects)
  onRouteLeave.current = null
})

describe('ProjectsPage', () => {
  it('shows an empty state while no projects exist', async () => {
    vi.mocked(useAppStore.getState().store.getProjects).mockResolvedValue([])
    renderWithProviders(<ProjectsPage />)

    expect(
      await screen.findByText('No projects yet, create one to get started.')
    ).toBeInTheDocument()
  })

  it('lists projects with their label tags', async () => {
    renderWithProviders(<ProjectsPage />)

    expect(await screen.findByText('Street Signs')).toBeInTheDocument()
    expect(screen.getByText('Wildlife Cams')).toBeInTheDocument()
    expect(screen.getByText('Stop Sign')).toBeInTheDocument()
    expect(screen.getByText('Yield Sign')).toBeInTheDocument()
    expect(screen.getByText('No labels')).toBeInTheDocument()
  })

  it('filters the list via the search box', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'wild' } })

    expect(screen.queryByText('Street Signs')).not.toBeInTheDocument()
    expect(screen.getByText('Wildlife Cams')).toBeInTheDocument()
  })

  it('navigates when a project is clicked', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.click(screen.getByText('Street Signs'))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('tasks', { project: projects[0] })
    })
  })

  it('edits a project name and label names via the context menu', async () => {
    vi.mocked(useAppStore.getState().store.updateProjects).mockImplementation(async (updates) => [
      {
        ...projects[0],
        name: updates[0].name ?? projects[0].name,
        labels: projects[0].labels.map((label) => {
          const updated = updates[0].labels?.find((l) => l.id === label.id)
          return updated ? { ...label, name: updated.name, color: updated.color } : label
        })
      }
    ])
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Edit'))

    const dialog = await screen.findByRole('dialog', { name: 'Edit Project' })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed Signs' } })
    fireEvent.change(screen.getByDisplayValue('Stop Sign'), {
      target: { value: 'Stop Sign Renamed' }
    })
    // The mutation settling triggers a refetch - point it at the post-edit state too, so
    // it doesn't revert the optimistic update back to the stale name once it lands.
    vi.mocked(useAppStore.getState().store.getProjects).mockResolvedValue([
      {
        ...projects[0],
        name: 'Renamed Signs',
        labels: [{ id: 'l1', name: 'Stop Sign Renamed', color: '#ff0000' }, projects[0].labels[1]]
      },
      projects[1]
    ])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.updateProjects).toHaveBeenCalledWith([
        {
          id: 'p1',
          name: 'Renamed Signs',
          labels: [
            { id: 'l1', name: 'Stop Sign Renamed', color: '#ff0000' },
            { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
          ]
        }
      ])
    })
    expect(await screen.findByText('Renamed Signs')).toBeInTheDocument()
  })

  it('deletes a project after confirming', async () => {
    vi.mocked(useAppStore.getState().store.deleteProjects).mockResolvedValue([true])
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Delete'))

    const dialogDeleteButton = await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(dialogDeleteButton)

    await waitFor(() => {
      expect(useAppStore.getState().store.deleteProjects).toHaveBeenCalledWith(['p1'])
    })
  })

  it('only shows checkboxes and toggles select-by-click after entering select mode via the Select button', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('checkbox', { name: 'Select Street Signs' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Street Signs'))

    expect(screen.getByRole('checkbox', { name: 'Select Street Signs' })).toBeChecked()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('Clear exits select mode entirely, hiding checkboxes again', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Street Signs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('right-click Select enters select mode with just that project selected', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    expect(screen.queryByText('Select All')).not.toBeInTheDocument()
    // The toolbar's own "Select" button is still visible outside select mode too, so
    // disambiguate by only clicking the context menu's copy of the text.
    const [selectMenuItem] = screen
      .getAllByText('Select')
      .filter((el) => el.closest('.mantine-contextmenu-item-button') !== null)
    fireEvent.click(selectMenuItem)

    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Street Signs' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Wildlife Cams' })).not.toBeChecked()
  })

  it('right-click Select All selects every currently visible (filtered) project', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Select All'))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Street Signs' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Wildlife Cams' })).toBeChecked()
  })

  it('right-click Select Above/Below selects a range within the currently visible list', async () => {
    vi.mocked(useAppStore.getState().store.getProjects).mockResolvedValue([
      ...projects,
      { id: 'p3', name: 'Gamma', labels: [] }
    ])
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.contextMenu(screen.getByText('Wildlife Cams'))
    fireEvent.click(screen.getByText('Select Above'))

    expect(screen.getByRole('checkbox', { name: 'Select Street Signs' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Wildlife Cams' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Gamma' })).not.toBeChecked()
  })

  it('exits select mode and clears the selection when the router reports leaving the page', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Street Signs' }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    act(() => onRouteLeave.current?.())

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('disables batch Delete while nothing is selected, and enables it once something is', async () => {
    renderWithProviders(<ProjectsPage />)
    await screen.findByText('Street Signs')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Street Signs' }))

    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })
})
