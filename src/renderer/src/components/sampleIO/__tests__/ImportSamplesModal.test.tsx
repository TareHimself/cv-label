import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject } from '@shared/types'

vi.mock('../importers/registry', () => {
  const importerA = {
    id: 'a',
    name: 'Importer A',
    description: 'Desc A',
    icon: null,
    Component: ({
      onComplete,
      onCancel
    }: {
      onComplete: (samples: []) => void
      onCancel: () => void
    }) => (
      <div>
        <p>Importer A Component</p>
        <button onClick={() => onComplete([])}>Finish A</button>
        <button onClick={onCancel}>Cancel A</button>
      </div>
    )
  }
  const importerB = {
    id: 'b',
    name: 'Importer B',
    description: 'Desc B',
    icon: null,
    Component: () => <div>Importer B Component</div>
  }
  return { importers: { a: importerA, b: importerB } }
})

import { ImportSamplesModal } from '../ImportSamplesModal'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }

describe('ImportSamplesModal', () => {
  it('always shows the format picker first, even before selecting anything', () => {
    renderWithProviders(
      <ImportSamplesModal opened project={project} onClose={vi.fn()} onImported={vi.fn()} />
    )

    expect(screen.getByText('Importer A')).toBeInTheDocument()
    expect(screen.getByText('Importer B')).toBeInTheDocument()
    expect(screen.queryByText('Importer A Component')).not.toBeInTheDocument()
  })

  it('selecting an importer shows its component', () => {
    renderWithProviders(
      <ImportSamplesModal opened project={project} onClose={vi.fn()} onImported={vi.fn()} />
    )

    fireEvent.click(screen.getByText('Importer A'))

    expect(screen.getByText('Importer A Component')).toBeInTheDocument()
    expect(screen.queryByText('Importer B')).not.toBeInTheDocument()
  })

  it('cancelling from within an importer returns to the picker', () => {
    renderWithProviders(
      <ImportSamplesModal opened project={project} onClose={vi.fn()} onImported={vi.fn()} />
    )

    fireEvent.click(screen.getByText('Importer A'))
    fireEvent.click(screen.getByText('Cancel A'))

    expect(screen.getByText('Importer A')).toBeInTheDocument()
    expect(screen.getByText('Importer B')).toBeInTheDocument()
  })

  it('completing an importer imports the samples and closes the modal', async () => {
    const onImported = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderWithProviders(
      <ImportSamplesModal opened project={project} onClose={onClose} onImported={onImported} />
    )

    fireEvent.click(screen.getByText('Importer A'))
    fireEvent.click(screen.getByText('Finish A'))

    await waitFor(() => expect(onImported).toHaveBeenCalledWith([]))
    expect(onClose).toHaveBeenCalled()
  })

  it('resets to the picker each time the modal is reopened', () => {
    const { rerender } = renderWithProviders(
      <ImportSamplesModal opened project={project} onClose={vi.fn()} onImported={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Importer A'))
    expect(screen.getByText('Importer A Component')).toBeInTheDocument()

    rerender(
      <ImportSamplesModal opened={false} project={project} onClose={vi.fn()} onImported={vi.fn()} />
    )
    rerender(<ImportSamplesModal opened project={project} onClose={vi.fn()} onImported={vi.fn()} />)

    expect(screen.getByText('Importer A')).toBeInTheDocument()
    expect(screen.queryByText('Importer A Component')).not.toBeInTheDocument()
  })
})
