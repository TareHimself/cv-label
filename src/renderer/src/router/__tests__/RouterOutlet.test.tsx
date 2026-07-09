import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

import { RouterOutlet } from '../RouterOutlet'

describe('RouterOutlet', () => {
  it('renders the projects page as the initial screen', () => {
    renderWithProviders(<RouterOutlet />)

    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument()
  })
})
