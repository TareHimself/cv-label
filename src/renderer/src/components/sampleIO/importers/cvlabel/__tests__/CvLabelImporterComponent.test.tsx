import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject } from '@shared/types'
import { installFakeFileSystem } from '../../__tests__/fakeFileSystem'
import { CvLabelImporterComponent } from '../CvLabelImporterComponent'

beforeEach(() => {
  installFakeFileSystem()
})

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [
    { id: 'l1', name: 'Person', color: '#ff0000' },
    { id: 'l2', name: 'Car', color: '#00ff00' }
  ]
}

const manifestJson = (labels: unknown[], samples: unknown[]) =>
  JSON.stringify({ version: 1, labels, tasks: [{ id: 't1', name: 'Batch 1', samples }] })

// Mantine's Dropzone renders a real <input type=file> under the hood and reacts to it the
// same way it would a drop - same interaction pattern as PlainImagesImporterComponent's
// own tests, which drive the equivalent Dropzone this way.
const getFileInput = () => document.querySelector('input[type=file]') as HTMLInputElement

const makeCvLabelFile = async (labels: unknown[], samples: unknown[], images: string[]) => {
  const zip = new JSZip()
  zip.file('manifest.json', manifestJson(labels, samples))
  for (const image of images) {
    zip.file(image, 'fake-image-bytes')
  }
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([buffer], 'export.cvlabel')
}

describe('CvLabelImporterComponent', () => {
  it('defaults each source label to a project label matching by id, then by name', async () => {
    const file = await makeCvLabelFile(
      [
        { id: 'l1', name: 'Whatever' }, // id matches project's l1 (Person) even though name differs
        { id: 'no-id-match', name: 'car' } // no id match, falls back to name match
      ],
      [
        {
          id: 's1',
          name: 'photo-one',
          split: 'train',
          annotations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        }
      ],
      ['images/s1.jpg']
    )

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(getFileInput(), { target: { files: [file] } })

    await screen.findByText('Whatever')
    expect(screen.getByText('car')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Person')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Car')).toBeInTheDocument()
  })

  it('leaves a label unmapped (Import disabled) when neither id nor name matches', async () => {
    const file = await makeCvLabelFile(
      [{ id: 'no-match', name: 'truck' }],
      [
        {
          id: 's1',
          name: 'photo-one',
          split: 'train',
          annotations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        }
      ],
      ['images/s1.jpg']
    )

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(getFileInput(), { target: { files: [file] } })

    await screen.findByText('truck')
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('lets the user explicitly Ignore an unmatched label, enabling Import and dropping its annotations', async () => {
    const file = await makeCvLabelFile(
      [{ id: 'no-match', name: 'truck' }],
      [
        {
          id: 's1',
          name: 'photo-one',
          split: 'train',
          annotations: [{ id: 'a1', type: 'box', labelId: 'no-match', points: [] }],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        }
      ],
      ['images/s1.jpg']
    )
    const onComplete = vi.fn()

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )

    fireEvent.change(getFileInput(), { target: { files: [file] } })
    await screen.findByText('truck')

    // Mantine's Select doesn't re-fire onChange for clicking the already-displayed
    // option, so go via a real label first to prove a genuine value change, then back
    // to Ignore - both of which are real transitions and should each fire onChange.
    fireEvent.click(screen.getByDisplayValue('Ignore'))
    fireEvent.click(await screen.findByText('Person'))
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()

    fireEvent.click(screen.getByDisplayValue('Person'))
    fireEvent.click(await screen.findByText('Ignore'))
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const samples = onComplete.mock.calls[0][0][0].samples
    expect(samples).toHaveLength(1)
    expect(samples[0].annotations).toHaveLength(0)
  })

  it('imports with the resolved mapping and calls onComplete', async () => {
    const file = await makeCvLabelFile(
      [{ id: 'l1', name: 'Human' }],
      [
        {
          id: 's1',
          name: 'photo-one',
          split: 'train',
          annotations: [{ id: 'a1', type: 'box', labelId: 'l1', points: [] }],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        }
      ],
      ['images/s1.jpg']
    )
    const onComplete = vi.fn()

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )

    fireEvent.change(getFileInput(), { target: { files: [file] } })
    await screen.findByText('Human')

    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const samples = onComplete.mock.calls[0][0][0].samples
    expect(samples).toHaveLength(1)
    expect(samples[0].name).toBe('photo-one')
    expect(samples[0].annotations[0].labelId).toBe('l1')
  })

  const makeMultiTaskCvLabelFile = async () => {
    const zip = new JSZip()
    zip.file(
      'manifest.json',
      JSON.stringify({
        version: 1,
        labels: [{ id: 'l1', name: 'Person' }],
        tasks: [
          {
            id: 't1',
            name: 'Batch 1',
            samples: [
              {
                id: 's1',
                name: 'photo-1',
                split: 'train',
                annotations: [],
                createdAt: '2026-01-01T00:00:00.000Z',
                imageFile: 'images/s1.jpg'
              }
            ]
          },
          {
            id: 't2',
            name: 'Batch 2',
            samples: [
              {
                id: 's2',
                name: 'photo-2',
                split: 'train',
                annotations: [],
                createdAt: '2026-01-01T00:00:00.000Z',
                imageFile: 'images/s2.jpg'
              }
            ]
          }
        ]
      })
    )
    zip.file('images/s1.jpg', 'x')
    zip.file('images/s2.jpg', 'x')
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })
    return new File([buffer], 'export.cvlabel')
  }

  it('merges every task into one group when "One Combined Task" is chosen', async () => {
    const file = await makeMultiTaskCvLabelFile()
    const onComplete = vi.fn()

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    fireEvent.click(await screen.findByRole('button', { name: 'One Combined Task' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const groups = onComplete.mock.calls[0][0]
    expect(groups).toHaveLength(1)
    expect(groups[0].samples).toHaveLength(2)
  })

  it('keeps tasks separate, one group per task, when "N Separate Tasks" is chosen', async () => {
    const file = await makeMultiTaskCvLabelFile()
    const onComplete = vi.fn()

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    fireEvent.click(await screen.findByRole('button', { name: '2 Separate Tasks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const groups = onComplete.mock.calls[0][0]
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ name: 'Batch 1' })
    expect(groups[0].samples).toHaveLength(1)
    expect(groups[1]).toMatchObject({ name: 'Batch 2' })
    expect(groups[1].samples).toHaveLength(1)
  })

  it('shows an error and stays on the selection step when there is no manifest.json', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'not a cvlabel file')
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })
    const file = new File([buffer], 'not-cvlabel.zip')

    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.change(getFileInput(), { target: { files: [file] } })

    await waitFor(() => {
      expect(getFileInput()).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked from the selection step', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <CvLabelImporterComponent project={project} onComplete={vi.fn()} onCancel={onCancel} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
