import { describe, expect, it, vi } from 'vitest'
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

vi.mock('../exporters/registry', () => {
  const exporterA = {
    id: 'a',
    name: 'Exporter A',
    description: 'Desc A',
    icon: null,
    Component: ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => (
      <div>
        <p>Exporter A Component</p>
        <button onClick={onComplete}>Finish A</button>
        <button onClick={onCancel}>Cancel A</button>
      </div>
    )
  }
  const exporterB = {
    id: 'b',
    name: 'Exporter B',
    description: 'Desc B',
    icon: null,
    Component: () => <div>Exporter B Component</div>
  }
  return { exporters: { a: exporterA, b: exporterB } }
})

import { ExportSamplesModal } from '../ExportSamplesModal'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }
const tasks: ITask[] = [{ id: 't1', name: 'Batch 1' }]

describe('ExportSamplesModal', () => {
  it('always shows the format picker first, even before selecting anything', () => {
    renderWithProviders(
      <ExportSamplesModal opened project={project} tasks={tasks} onClose={vi.fn()} />
    )

    expect(screen.getByText('Exporter A')).toBeInTheDocument()
    expect(screen.getByText('Exporter B')).toBeInTheDocument()
    expect(screen.queryByText('Exporter A Component')).not.toBeInTheDocument()
  })

  it('selecting an exporter shows its component', () => {
    renderWithProviders(
      <ExportSamplesModal opened project={project} tasks={tasks} onClose={vi.fn()} />
    )

    fireEvent.click(screen.getByText('Exporter A'))

    expect(screen.getByText('Exporter A Component')).toBeInTheDocument()
    expect(screen.queryByText('Exporter B')).not.toBeInTheDocument()
  })

  it('cancelling from within an exporter returns to the picker', () => {
    renderWithProviders(
      <ExportSamplesModal opened project={project} tasks={tasks} onClose={vi.fn()} />
    )

    fireEvent.click(screen.getByText('Exporter A'))
    fireEvent.click(screen.getByText('Cancel A'))

    expect(screen.getByText('Exporter A')).toBeInTheDocument()
    expect(screen.getByText('Exporter B')).toBeInTheDocument()
  })

  it('completing an exporter closes the modal', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <ExportSamplesModal opened project={project} tasks={tasks} onClose={onClose} />
    )

    fireEvent.click(screen.getByText('Exporter A'))
    fireEvent.click(screen.getByText('Finish A'))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('resets to the picker each time the modal is reopened', () => {
    const { rerender } = renderWithProviders(
      <ExportSamplesModal opened project={project} tasks={tasks} onClose={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Exporter A'))
    expect(screen.getByText('Exporter A Component')).toBeInTheDocument()

    rerender(
      <ExportSamplesModal opened={false} project={project} tasks={tasks} onClose={vi.fn()} />
    )
    rerender(<ExportSamplesModal opened project={project} tasks={tasks} onClose={vi.fn()} />)

    expect(screen.getByText('Exporter A')).toBeInTheDocument()
    expect(screen.queryByText('Exporter A Component')).not.toBeInTheDocument()
  })
})
