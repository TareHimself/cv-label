import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ContextMenuProvider } from 'mantine-contextmenu'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

import { useAppStore } from '@renderer/hooks/useAppStore'
import App from '../App'

beforeEach(() => {
  vi.mocked(useAppStore.getState().store.getProjects).mockReset().mockResolvedValue([])
})

describe('App', () => {
  it('boots to the projects page by default', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ContextMenuProvider>
            <App />
          </ContextMenuProvider>
        </MantineProvider>
      </QueryClientProvider>
    )

    expect(await screen.findByRole('button', { name: 'Create Project' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
  })
})
