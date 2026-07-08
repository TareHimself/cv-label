import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Versions from '../Versions'

beforeEach(() => {
  window.electron = {
    process: {
      versions: {
        electron: '30.0.0',
        chrome: '124.0.0',
        node: '20.11.0'
      }
    }
  } as unknown as typeof window.electron
})

describe('Versions', () => {
  it('renders the electron, chrome and node versions', () => {
    render(<Versions />)

    expect(screen.getByText('Electron v30.0.0')).toBeInTheDocument()
    expect(screen.getByText('Chromium v124.0.0')).toBeInTheDocument()
    expect(screen.getByText('Node v20.11.0')).toBeInTheDocument()
  })
})
