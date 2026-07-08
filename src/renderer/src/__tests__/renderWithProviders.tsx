import { MantineProvider } from '@mantine/core'
import { ContextMenuProvider } from 'mantine-contextmenu'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router'
import type { ReactElement, ReactNode } from 'react'

export type RenderWithProvidersOptions = RenderOptions & {
  routerProps?: MemoryRouterProps
}

export const renderWithProviders = (ui: ReactElement, options?: RenderWithProvidersOptions) => {
  const { routerProps, ...renderOptions } = options ?? {}

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ContextMenuProvider submenuDelay={0}>
          <MemoryRouter {...routerProps}>{children}</MemoryRouter>
        </ContextMenuProvider>
      </MantineProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
