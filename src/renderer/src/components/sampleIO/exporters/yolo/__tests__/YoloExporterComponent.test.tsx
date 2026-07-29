import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AnnotationType, IProject, ISample, ITask, TrainingSplit } from '@shared/types'

const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => toastError(...args) }
}))

import { YoloExporterComponent } from '../YoloExporterComponent'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [{ id: 'l1', name: 'Stop Sign', color: '#ff0000' }]
}
const tasks: ITask[] = [{ id: 't1', name: 'Batch 1' }]

const sample: ISample = {
  id: 's1',
  name: 'photo-one',
  imageUri: 'cv-label-image://s1.jpg',
  split: TrainingSplit.Train,
  width: 400,
  height: 300,
  annotations: [
    {
      id: 'a1',
      type: AnnotationType.Box,
      labelId: 'l1',
      points: [
        { id: 'p0', x: 100, y: 50 },
        { id: 'p1', x: 300, y: 150 }
      ]
    }
  ],
  completedAt: null,
  createdAt: new Date().toISOString()
}

const runExport = vi.fn()

beforeEach(() => {
  toastError.mockReset()
  runExport.mockReset().mockResolvedValue(true)
  window.exportApi = {
    runExport,
    onProgress: vi.fn().mockReturnValue(() => {})
  } as unknown as typeof window.exportApi
})

describe('YoloExporterComponent', () => {
  it('builds a manifest of images/labels by split plus a data.yaml, and calls onComplete on save', async () => {
    const onComplete = vi.fn()

    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([sample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(runExport).toHaveBeenCalledWith('Street Signs-yolo-export.zip', {
      textEntries: [
        { path: 'labels/train/s1.txt', content: '0 0.500000 0.333333 0.500000 0.333333\n' },
        {
          path: 'data.yaml',
          content:
            'train: images/train\nval: images/valid\ntest: images/test\nnames:\n  0: Stop Sign\n'
        }
      ],
      imageEntries: [{ path: 'images/train/s1.jpg', imageUri: 'cv-label-image://s1.jpg' }]
    })
  })

  it('switches to Segments and exports the box as its own 4-corner polygon', async () => {
    const onComplete = vi.fn()

    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([sample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Segments'))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const manifest = runExport.mock.calls[0][1]
    expect(manifest.textEntries[0]).toEqual({
      path: 'labels/train/s1.txt',
      content: '0 0.250000 0.166667 0.750000 0.166667 0.750000 0.500000 0.250000 0.500000\n'
    })
  })

  it('does not call onComplete when the user cancels the save dialog', async () => {
    runExport.mockResolvedValue(false)
    const onComplete = vi.fn()

    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([sample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(runExport).toHaveBeenCalled())
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows an error toast and re-enables Export when fetching samples fails', async () => {
    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockRejectedValue(new Error('boom'))}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to export samples'))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('shows a preparing message while fetching samples, then a waiting message before the first progress event, then a percentage', async () => {
    let resolveGetSamples: (samples: ISample[]) => void = () => {}
    const getSamplesForTask = vi.fn(
      () => new Promise<ISample[]>((resolve) => (resolveGetSamples = resolve))
    )
    let capturedOnProgress: ((event: { completed: number; total: number }) => void) | undefined
    window.exportApi = {
      runExport: vi.fn().mockImplementation(() => new Promise(() => {})),
      onProgress: vi.fn().mockImplementation((cb) => {
        capturedOnProgress = cb
        return () => {}
      })
    } as unknown as typeof window.exportApi

    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={getSamplesForTask}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(await screen.findByText('Preparing export…')).toBeInTheDocument()

    resolveGetSamples([sample])
    expect(await screen.findByText('Waiting for save location…')).toBeInTheDocument()

    capturedOnProgress?.({ completed: 1, total: 1 })
    expect(await screen.findByText('Exporting samples… 100%')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([])}
        onComplete={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
