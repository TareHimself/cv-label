import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AnnotationType, IProject, ISample, ITask, TrainingSplit } from '@shared/types'

const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => toastError(...args) }
}))

import { CocoExporterComponent } from '../CocoExporterComponent'

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
        { id: 'p0', x: 10, y: 20 },
        { id: 'p1', x: 110, y: 70 }
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

describe('CocoExporterComponent', () => {
  it('defaults to As Is: zips images plus a per-split _annotations.coco.json with no segmentation for a plain Box', async () => {
    const onComplete = vi.fn()

    renderWithProviders(
      <CocoExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([sample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(saveFile).toHaveBeenCalledWith('Street Signs-coco-export.zip', expect.any(ArrayBuffer))

    const zip = await JSZip.loadAsync(saveFile.mock.calls[0][1])
    expect(await zip.file('train/s1.jpg')?.async('string')).toBe('fake-image-bytes')

    const annotationsJson = await zip.file('train/_annotations.coco.json')?.async('string')
    expect(JSON.parse(annotationsJson ?? '')).toEqual({
      images: [{ id: 1, file_name: 's1.jpg', width: 400, height: 200 }],
      annotations: [
        {
          id: 1,
          image_id: 1,
          category_id: 1,
          bbox: [10, 20, 100, 50],
          area: 5000,
          segmentation: [],
          iscrowd: 0
        }
      ],
      categories: [{ id: 1, name: 'Stop Sign', supercategory: 'none' }]
    })
  })

  it('switches to Segments and gives a plain Box a synthesized rectangular segmentation', async () => {
    const onComplete = vi.fn()

    renderWithProviders(
      <CocoExporterComponent
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
    const annotationsJson = await zip.file('train/_annotations.coco.json')?.async('string')
    const { annotations } = JSON.parse(annotationsJson ?? '')

    expect(annotations[0].segmentation).toEqual([[10, 20, 110, 20, 110, 70, 10, 70]])
  })

  it("switches to Bounding Boxes and discards a Mask annotation's real outline", async () => {
    const maskSample: ISample = {
      ...sample,
      annotations: [
        {
          id: 'a1',
          type: AnnotationType.Mask,
          labelId: 'l1',
          points: [
            { id: 'p0', x: 0, y: 0 },
            { id: 'p1', x: 20, y: 5 },
            { id: 'p2', x: 10, y: 10 }
          ]
        }
      ]
    }
    const onComplete = vi.fn()

    renderWithProviders(
      <CocoExporterComponent
        project={project}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([maskSample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Bounding Boxes'))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const zip = await JSZip.loadAsync(saveFile.mock.calls[0][1])
    const annotationsJson = await zip.file('train/_annotations.coco.json')?.async('string')
    const { annotations } = JSON.parse(annotationsJson ?? '')

    expect(annotations[0].bbox).toEqual([0, 0, 20, 10])
    expect(annotations[0].segmentation).toEqual([])
  })

  it('does not call onComplete when the user cancels the save dialog', async () => {
    saveFile.mockResolvedValue(false)
    const onComplete = vi.fn()

    renderWithProviders(
      <CocoExporterComponent
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
      <CocoExporterComponent
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
      <CocoExporterComponent
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
