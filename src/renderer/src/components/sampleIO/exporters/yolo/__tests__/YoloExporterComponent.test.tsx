import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
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

const saveFile = vi.fn()

beforeEach(() => {
  toastError.mockReset()
  saveFile.mockReset().mockResolvedValue(true)
  window.system = { saveFile } as unknown as typeof window.system
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['fake-image-bytes'])) })
  )
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 400, height: 200, close: vi.fn() })
  )
})

describe('YoloExporterComponent', () => {
  it('zips images/labels by split plus a data.yaml, and calls onComplete on save', async () => {
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
    expect(saveFile).toHaveBeenCalledWith('Street Signs-yolo-export.zip', expect.any(ArrayBuffer))

    const zip = await JSZip.loadAsync(saveFile.mock.calls[0][1])
    expect(await zip.file('images/train/s1.jpg')?.async('string')).toBe('fake-image-bytes')
    expect(await zip.file('labels/train/s1.txt')?.async('string')).toBe(
      '0 0.500000 0.500000 0.500000 0.500000\n'
    )
    expect(await zip.file('data.yaml')?.async('string')).toBe(
      'train: images/train\nval: images/valid\ntest: images/test\nnames:\n  0: Stop Sign\n'
    )
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
    const zip = await JSZip.loadAsync(saveFile.mock.calls[0][1])
    expect(await zip.file('labels/train/s1.txt')?.async('string')).toBe(
      '0 0.250000 0.250000 0.750000 0.250000 0.750000 0.750000 0.250000 0.750000\n'
    )
  })

  it('does not call onComplete when the user cancels the save dialog', async () => {
    saveFile.mockResolvedValue(false)
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

    await waitFor(() => expect(saveFile).toHaveBeenCalled())
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows an error toast and re-enables Export when a sample fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    renderWithProviders(
      <YoloExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([sample])}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to export samples'))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
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
