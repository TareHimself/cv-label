import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AnnotationType, IProject, ISample, ITask, TrainingSplit } from '@shared/types'

const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => toastError(...args) }
}))

import { CvLabelJsonExporterComponent } from '../CvLabelJsonExporterComponent'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [{ id: 'l1', name: 'Stop Sign', color: '#ff0000' }]
}
const tasks: ITask[] = [{ id: 't1', name: 'Batch 1' }]

const sample: ISample = {
  id: 's1',
  name: 'photo-one',
  imageUri: 'cv-label-image://s1.png',
  split: TrainingSplit.Train,
  width: 400,
  height: 300,
  annotations: [{ id: 'a1', type: AnnotationType.Box, labelId: 'l1', points: [] }],
  completedAt: new Date().toISOString(),
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

describe('CvLabelJsonExporterComponent', () => {
  it('fetches every task/sample and builds a manifest with a flat sample list, calling onComplete on save', async () => {
    const getSamplesForTask = vi.fn().mockResolvedValue([sample])
    const onComplete = vi.fn()

    renderWithProviders(
      <CvLabelJsonExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={getSamplesForTask}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(getSamplesForTask).toHaveBeenCalledWith('t1')
    expect(runExport).toHaveBeenCalledTimes(1)
    const [suggestedName, manifest] = runExport.mock.calls[0]
    expect(suggestedName).toBe('Street Signs.cvlabel')
    expect(manifest.imageEntries).toEqual([
      { path: 'images/s1.png', imageUri: 'cv-label-image://s1.png' }
    ])

    const manifestJson = manifest.textEntries.find(
      (e: { path: string }) => e.path === 'manifest.json'
    ).content
    expect(JSON.parse(manifestJson)).toEqual({
      labels: [{ id: 'l1', name: 'Stop Sign' }],
      samples: [
        {
          id: 's1',
          name: 'photo-one',
          split: TrainingSplit.Train,
          annotations: sample.annotations,
          createdAt: sample.createdAt,
          width: sample.width,
          height: sample.height,
          imageFile: 'images/s1.png'
        }
      ]
    })
  })

  it('does not call onComplete when the user cancels the save dialog', async () => {
    runExport.mockResolvedValue(false)
    const onComplete = vi.fn()

    renderWithProviders(
      <CvLabelJsonExporterComponent
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
      <CvLabelJsonExporterComponent
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
      <CvLabelJsonExporterComponent
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
      <CvLabelJsonExporterComponent
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
