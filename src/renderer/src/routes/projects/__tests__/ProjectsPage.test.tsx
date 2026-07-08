import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
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

import { useAppStore } from '@renderer/hooks/useAppStore'
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
  window.navigate = vi.fn()
  vi.mocked(useAppStore.getState().store.getProjects).mockReset().mockResolvedValue(projects)
})

describe('ProjectsPage', () => {
  it('shows an empty state while no projects exist', async () => {
    vi.mocked(useAppStore.getState().store.getProjects).mockResolvedValue([])
    renderWithProviders(<ProjectsPage />)

    expect(
      await screen.findByText('No projects yet — create one to get started.')
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
      expect(window.navigate).toHaveBeenCalledWith('/tasks/p1', { state: { project: projects[0] } })
    })
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
})
