import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
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
  annotations: [{ id: 'a1', type: AnnotationType.Box, labelId: 'l1', points: [] }],
  completedAt: new Date().toISOString(),
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
})

describe('CvLabelJsonExporterComponent', () => {
  it('fetches every task/sample, zips them into a .cvlabel file with a flat manifest, and calls onComplete on save', async () => {
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
    expect(fetch).toHaveBeenCalledWith(sample.imageUri)
    expect(saveFile).toHaveBeenCalledWith('Street Signs.cvlabel', expect.any(ArrayBuffer))

    const zip = await JSZip.loadAsync(saveFile.mock.calls[0][1])
    expect(await zip.file('images/s1.png')?.async('string')).toBe('fake-image-bytes')

    const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '')
    expect(manifest).toEqual({
      labels: [{ id: 'l1', name: 'Stop Sign' }],
      samples: [
        {
          id: 's1',
          name: 'photo-one',
          split: TrainingSplit.Train,
          annotations: sample.annotations,
          createdAt: sample.createdAt,
          imageFile: 'images/s1.png'
        }
      ]
    })
  })

  it('does not call onComplete when the user cancels the save dialog', async () => {
    saveFile.mockResolvedValue(false)
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

    await waitFor(() => expect(saveFile).toHaveBeenCalled())
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows an error toast and re-enables Export when a sample fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    renderWithProviders(
      <CvLabelJsonExporterComponent
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
