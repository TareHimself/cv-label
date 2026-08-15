import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject } from '@shared/types'
import { CocoImporterComponent } from '../CocoImporterComponent'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [
    { id: 'l1', name: 'Person', color: '#ff0000' },
    { id: 'l2', name: 'Car', color: '#00ff00' }
  ]
}

const makeFile = (name: string, content: string) => new File([content], name)

const cocoJson = (images: unknown[], annotations: unknown[], categories: unknown[]) =>
  JSON.stringify({ images, annotations, categories })

const createTemporaryDirectory = vi.fn()
const writeFile = vi.fn()

beforeEach(() => {
  createTemporaryDirectory.mockReset().mockResolvedValue('/scratch')
  writeFile.mockReset().mockResolvedValue(undefined)
  window.system = { createTemporaryDirectory, writeFile } as unknown as typeof window.system
})

describe('CocoImporterComponent', () => {
  it('goes from folder selection to the class-mapping step, defaulting each class to the same-named project label', async () => {
    renderWithProviders(
      <CocoImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(screen.getByTestId('coco-folder-input'), {
      target: {
        files: [
          makeFile('img1.jpg', 'x'),
          makeFile(
            '_annotations.coco.json',
            cocoJson(
              [{ id: 1, file_name: 'img1.jpg' }],
              [],
              [
                { id: 1, name: 'person' },
                { id: 2, name: 'car' }
              ]
            )
          )
        ]
      }
    })

    await screen.findByText('person')
    expect(screen.getByText('car')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Person')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Car')).toBeInTheDocument()
  })

  it('falls back to the first project label when no category name matches', async () => {
    renderWithProviders(
      <CocoImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(screen.getByTestId('coco-folder-input'), {
      target: {
        files: [
          makeFile('img1.jpg', 'x'),
          makeFile(
            '_annotations.coco.json',
            cocoJson([{ id: 1, file_name: 'img1.jpg' }], [], [{ id: 1, name: 'truck' }])
          )
        ]
      }
    })

    await screen.findByText('truck')
    expect(screen.getByDisplayValue('Person')).toBeInTheDocument()
  })

  it('imports with the chosen mapping and calls onComplete', async () => {
    const onComplete = vi.fn()
    renderWithProviders(
      <CocoImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )

    fireEvent.change(screen.getByTestId('coco-folder-input'), {
      target: {
        files: [
          makeFile('img1.jpg', 'x'),
          makeFile(
            '_annotations.coco.json',
            cocoJson(
              [{ id: 1, file_name: 'img1.jpg' }],
              [{ image_id: 1, category_id: 1, bbox: [0, 0, 10, 10] }],
              [{ id: 1, name: 'person' }]
            )
          )
        ]
      }
    })
    await screen.findByText('person')

    // Remap the only class from the default (Person) to Car. Mantine's Select isn't a
    // native <select>, so it needs the usual open-then-click-option interaction.
    fireEvent.click(screen.getByDisplayValue('Person'))
    fireEvent.click(await screen.findByText('Car'))
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const samples = onComplete.mock.calls[0][0]
    expect(samples).toHaveLength(1)
    expect(samples[0].annotations[0].labelId).toBe('l2')
  })

  it('excludes a class marked Ignore, without blocking Import, and drops its annotations', async () => {
    const onComplete = vi.fn()
    renderWithProviders(
      <CocoImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )

    fireEvent.change(screen.getByTestId('coco-folder-input'), {
      target: {
        files: [
          makeFile('img1.jpg', 'x'),
          makeFile(
            '_annotations.coco.json',
            cocoJson(
              [{ id: 1, file_name: 'img1.jpg' }],
              [{ image_id: 1, category_id: 1, bbox: [0, 0, 10, 10] }],
              [{ id: 1, name: 'person' }]
            )
          )
        ]
      }
    })
    await screen.findByText('person')

    fireEvent.click(screen.getByDisplayValue('Person'))
    fireEvent.click(await screen.findByText('Ignore'))
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const samples = onComplete.mock.calls[0][0]
    expect(samples).toHaveLength(1)
    expect(samples[0].annotations).toHaveLength(0)
  })

  it('shows an error and stays on the selection step when no images are found', async () => {
    renderWithProviders(
      <CocoImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(screen.getByTestId('coco-folder-input'), {
      target: { files: [makeFile('readme.txt', 'no images here')] }
    })

    await waitFor(() => {
      expect(screen.getByTestId('coco-folder-input')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument()
  })

  it('disables Import when the project has no labels to map to', async () => {
    const emptyProject: IProject = { id: 'p2', name: 'Empty', labels: [] }
    renderWithProviders(
      <CocoImporterComponent project={emptyProject} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(screen.getByTestId('coco-folder-input'), {
      target: {
        files: [
          makeFile('img1.jpg', 'x'),
          makeFile(
            '_annotations.coco.json',
            cocoJson([{ id: 1, file_name: 'img1.jpg' }], [], [{ id: 1, name: 'person' }])
          )
        ]
      }
    })

    await screen.findByText('person')
    expect(screen.getByText(/This project has no labels/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('calls onCancel when Cancel is clicked from the selection step', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <CocoImporterComponent project={project} onComplete={vi.fn()} onCancel={onCancel} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
