import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
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
  width: 400,
  height: 300,
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

const runExport = vi.fn()

beforeEach(() => {
  toastError.mockReset()
  runExport.mockReset().mockResolvedValue(true)
  window.exportApi = {
    runExport,
    onProgress: vi.fn().mockReturnValue(() => {})
  } as unknown as typeof window.exportApi
})

describe('CocoExporterComponent', () => {
  it('defaults to As Is: builds a manifest of images plus a per-split _annotations.coco.json with no segmentation for a plain Box', async () => {
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
    expect(runExport).toHaveBeenCalledTimes(1)
    const [suggestedName, manifest] = runExport.mock.calls[0]
    // A single task exported alone suggests that task's own name, not the project's.
    expect(suggestedName).toBe('Batch 1-coco-export.zip')
    expect(manifest.imageEntries).toEqual([
      { path: 'train/s1.jpg', imageUri: 'cv-label-image://s1.jpg' }
    ])

    const annotationsJson = manifest.textEntries.find(
      (e: { path: string }) => e.path === 'train/_annotations.coco.json'
    ).content
    expect(JSON.parse(annotationsJson)).toEqual({
      images: [{ id: 1, file_name: 's1.jpg', width: 400, height: 300 }],
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

  it('suggests the project name when exporting more than one task', async () => {
    const onComplete = vi.fn()
    const multipleTasks: ITask[] = [...tasks, { id: 't2', name: 'Batch 2' }]

    renderWithProviders(
      <CocoExporterComponent
        project={project}
        tasks={multipleTasks}
        getSamplesForTask={vi.fn().mockResolvedValue([sample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const [suggestedName] = runExport.mock.calls[0]
    expect(suggestedName).toBe('Street Signs-coco-export.zip')
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
    const manifest = runExport.mock.calls[0][1]
    const annotationsJson = manifest.textEntries.find(
      (e: { path: string }) => e.path === 'train/_annotations.coco.json'
    ).content
    const { annotations } = JSON.parse(annotationsJson)

    expect(annotations[0].segmentation).toEqual([[10, 20, 110, 20, 110, 70, 10, 70]])
  })

  it("switches to Bounding Boxes and discards a Polygon annotation's real outline", async () => {
    const polygonSample: ISample = {
      ...sample,
      annotations: [
        {
          id: 'a1',
          type: AnnotationType.Polygon,
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
        getSamplesForTask={vi.fn().mockResolvedValue([polygonSample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Bounding Boxes'))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const manifest = runExport.mock.calls[0][1]
    const annotationsJson = manifest.textEntries.find(
      (e: { path: string }) => e.path === 'train/_annotations.coco.json'
    ).content
    const { annotations } = JSON.parse(annotationsJson)

    expect(annotations[0].bbox).toEqual([0, 0, 20, 10])
    expect(annotations[0].segmentation).toEqual([])
  })

  it("excludes a label marked Don't Export: its annotations and category are dropped, the image stays", async () => {
    const twoLabelProject: IProject = {
      id: 'p1',
      name: 'Street Signs',
      labels: [
        { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
        { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
      ]
    }
    const twoLabelSample: ISample = {
      ...sample,
      annotations: [
        ...sample.annotations,
        {
          id: 'a2',
          type: AnnotationType.Box,
          labelId: 'l2',
          points: [
            { id: 'p2', x: 0, y: 0 },
            { id: 'p3', x: 5, y: 5 }
          ]
        }
      ]
    }
    const onComplete = vi.fn()

    renderWithProviders(
      <CocoExporterComponent
        project={twoLabelProject}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([twoLabelSample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByDisplayValue('Yield Sign'))
    fireEvent.click(await screen.findByRole('option', { name: "Don't Export" }))

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const manifest = runExport.mock.calls[0][1]
    expect(manifest.imageEntries).toEqual([
      { path: 'train/s1.jpg', imageUri: 'cv-label-image://s1.jpg' }
    ])
    const { annotations, categories } = JSON.parse(
      manifest.textEntries.find((e: { path: string }) => e.path === 'train/_annotations.coco.json')
        .content
    )
    expect(categories).toEqual([{ id: 1, name: 'Stop Sign', supercategory: 'none' }])
    expect(annotations).toHaveLength(1)
    expect(annotations[0].category_id).toBe(1)
  })

  it('merges one label into another: both end up under a single category', async () => {
    const twoLabelProject: IProject = {
      id: 'p1',
      name: 'Street Signs',
      labels: [
        { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
        { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
      ]
    }
    const twoLabelSample: ISample = {
      ...sample,
      annotations: [
        ...sample.annotations,
        {
          id: 'a2',
          type: AnnotationType.Box,
          labelId: 'l2',
          points: [
            { id: 'p2', x: 0, y: 0 },
            { id: 'p3', x: 5, y: 5 }
          ]
        }
      ]
    }
    const onComplete = vi.fn()

    renderWithProviders(
      <CocoExporterComponent
        project={twoLabelProject}
        tasks={tasks}
        getSamplesForTask={vi.fn().mockResolvedValue([twoLabelSample])}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByDisplayValue('Yield Sign'))
    fireEvent.click(await screen.findByRole('option', { name: 'Stop Sign' }))

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const manifest = runExport.mock.calls[0][1]
    const { annotations, categories } = JSON.parse(
      manifest.textEntries.find((e: { path: string }) => e.path === 'train/_annotations.coco.json')
        .content
    )
    expect(categories).toEqual([{ id: 1, name: 'Stop Sign', supercategory: 'none' }])
    expect(annotations).toHaveLength(2)
    expect(annotations.every((a: { category_id: number }) => a.category_id === 1)).toBe(true)
  })

  it('does not call onComplete when the user cancels the save dialog', async () => {
    runExport.mockResolvedValue(false)
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

    await waitFor(() => expect(runExport).toHaveBeenCalled())
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows an error toast and re-enables Export when fetching samples fails', async () => {
    renderWithProviders(
      <CocoExporterComponent
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
      <CocoExporterComponent
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
