// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import 'mantine-contextmenu/styles.css'
// import '@mantine/modals/styles.css'
// import '@mantine/notifications/styles.css'
import './assets/main.css'
import { Toaster } from 'react-hot-toast'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core';
import { ContextMenuProvider } from 'mantine-contextmenu';
import { QueryClientProvider } from '@tanstack/react-query'
import App from '@renderer/App'
import { queryClient } from './query/client'



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="dark">
        <ContextMenuProvider>
          <App />
          <Toaster position="bottom-left" />
        </ContextMenuProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>
)