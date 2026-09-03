import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, fireEvent, within, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { installFakeFileSystem } from '@renderer/components/sampleIO/importers/__tests__/fakeFileSystem'
import { CreateTaskButton } from '../CreateTaskButton'
import { IProject } from '@shared/types'

const fileSizeByPath = new Map<string, number>()
const createTemporaryDirectory = vi.fn()
const writeFile = vi.fn((filePath: string, data: ArrayBuffer) => {
  fileSizeByPath.set(filePath, data.byteLength)
  return Promise.resolve()
})
const getFileSize = vi.fn((filePath: string) => Promise.resolve(fileSizeByPath.get(filePath) ?? 0))
const getScratchPreviewUri = vi.fn((filePath: string) =>
  Promise.resolve(`scratch://${encodeURIComponent(filePath)}`)
)
const deleteDirectory = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()

  fileSizeByPath.clear()
  createTemporaryDirectory.mockReset().mockResolvedValue('/scratch')
  writeFile.mockClear()
  getFileSize.mockClear()
  getScratchPreviewUri.mockClear()
  deleteDirectory.mockClear()
  window.system = {
    createTemporaryDirectory,
    writeFile,
    getFileSize,
    getScratchPreviewUri,
    deleteDirectory
  } as unknown as typeof window.system
})

const project: IProject = { id: 'project-1', name: 'Test Project', labels: [] }

const makeFile = (name: string, sizeInBytes: number) => {
  const file = new File([new Uint8Array(sizeInBytes)], name, { type: 'image/jpeg' })
  return file
}

const openModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))
  const importDialog = await screen.findByRole('dialog', { name: /Import Samples/ })
  fireEvent.click(within(importDialog).getByText('None'))
  return screen.findByLabelText('Name')
}

const addSamplesViaImporter = async (files: File[]) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add Samples' }))
  const importDialog = await screen.findByRole('dialog', { name: /Import Samples/ })
  fireEvent.click(within(importDialog).getByText('Plain Images'))
  const input = importDialog.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
  // The importer completes as soon as files are selected, closing the nested modal.
  await screen.findByRole('dialog', { name: 'Create Task' })
}

// The full-screen Dropzone's own hidden input goes through the same react-dropzone
// file-selector pipeline as a real folder drag-and-drop, reading `webkitRelativePath`
// off each File the same way a browser would when a directory is dropped.
const dropFiles = (files: File[]) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

const projectWithLabel: IProject = {
  id: 'project-1',
  name: 'Test Project',
  labels: [{ id: 'l1', name: 'Text', color: '#fff' }]
}

const makeCvLabelFile = async (name: string, labels: unknown[], samples: unknown[]) => {
  const zip = new JSZip()
  zip.file(
    'manifest.json',
    JSON.stringify({ version: 1, labels, tasks: [{ id: 't1', name: 'Batch 1', samples }] })
  )
  zip.file('images/s1.jpg', 'fake-image-bytes')
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([buffer], name)
}

const makeMultiTaskCvLabelFile = async (name: string, labels: unknown[]) => {
  const zip = new JSZip()
  zip.file(
    'manifest.json',
    JSON.stringify({
      version: 1,
      labels,
      tasks: [
        { id: 't1', name: 'Batch 1', samples: oneCvLabelSample },
        {
          id: 't2',
          name: 'Batch 2',
          samples: [{ ...oneCvLabelSample[0], id: 's2', imageFile: 'images/s2.jpg' }]
        }
      ]
    })
  )
  zip.file('images/s1.jpg', 'fake-image-bytes')
  zip.file('images/s2.jpg', 'fake-image-bytes')
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([buffer], name)
}

const oneCvLabelSample = [
  {
    id: 's1',
    name: 'photo-one',
    split: 'train',
    annotations: [{ id: 'a1', type: 'box', labelId: 'l1', points: [] }],
    createdAt: '2026-01-01T00:00:00.000Z',
    imageFile: 'images/s1.jpg'
  }
]

describe('CreateTaskButton', () => {
  it('opens the modal showing an empty file list', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

    await openModal()

    expect(screen.getByText('No files selected yet')).toBeInTheDocument()
  })

  it('lists selected files with name and size, and a running count', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)
    await openModal()

    await addSamplesViaImporter([makeFile('photo-one.jpg', 1024), makeFile('photo-two.jpg', 2048)])

    expect(await screen.findByText('photo-one')).toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
    expect(screen.getByText('1.0 KB')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('2 files')).toBeInTheDocument()
  })

  it('removes an individual file', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)
    await openModal()

    await addSamplesViaImporter([makeFile('photo-one.jpg', 1024), makeFile('photo-two.jpg', 2048)])
    await screen.findByText('photo-one')

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove file' })[0])

    expect(screen.queryByText('photo-one')).not.toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
    expect(screen.getByText('1 file')).toBeInTheDocument()
  })

  it('clears all files', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)
    await openModal()

    await addSamplesViaImporter([makeFile('photo-one.jpg', 1024)])
    await screen.findByText('photo-one')

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(screen.getByText('No files selected yet')).toBeInTheDocument()
  })

  it('disables Create until a name is entered, then calls create with name and samples', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)
    await openModal()

    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Batch 1' } })
    expect(createButton).toBeEnabled()

    await addSamplesViaImporter([makeFile('photo-one.jpg', 1024)])
    await screen.findByText('photo-one')

    fireEvent.click(createButton)

    expect(create).toHaveBeenCalledTimes(1)
    const [name, samples] = create.mock.calls[0]
    expect(name).toBe('Batch 1')
    expect(samples).toHaveLength(1)
    expect(samples[0].name).toBe('photo-one')
  })

  it('ignores a second rapid click on Create while the first create call is still pending', async () => {
    let resolveCreate: (() => void) | undefined
    const create = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve
        })
    )
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 tasks' }))
    await screen.findByRole('dialog', { name: 'Create Task (1/2)' })

    const createButton = screen.getByRole('button', { name: 'Create' })
    fireEvent.click(createButton)
    fireEvent.click(createButton)

    expect(create).toHaveBeenCalledTimes(1)
    resolveCreate?.()
  })

  it('prefills the task name from a dropped folder', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)

    const file = makeFile('img1.jpg', 1024)
    Object.defineProperty(file, 'webkitRelativePath', { value: 'MyDataset/img1.jpg' })

    dropFiles([file])

    expect(await screen.findByLabelText('Name')).toHaveValue('MyDataset')
  })

  it('leaves the task name blank for a flat (non-folder) file drop', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)

    dropFiles([makeFile('img1.jpg', 1024)])

    expect(await screen.findByLabelText('Name')).toHaveValue('')
  })

  const makeFolderFile = (relativePath: string, sizeInBytes: number) => {
    const file = makeFile(relativePath.split('/').pop() as string, sizeInBytes)
    Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
    return file
  }

  it('asks to split into separate tasks when a drop spans multiple folders', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])

    expect(await screen.findByText(/You dropped 2 folders/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, 2 tasks' })).toBeInTheDocument()
  })

  it('steps through one Create Task modal per folder, showing an x/y indicator, and creates each on confirm', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 tasks' }))

    expect(await screen.findByRole('dialog', { name: 'Create Task (1/2)' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('FolderA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('dialog', { name: 'Create Task (2/2)' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('FolderB')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Create Task/ })).not.toBeInTheDocument()
    })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0]).toBe('FolderA')
    expect(create.mock.calls[1][0]).toBe('FolderB')
  })

  it('disables the Create button immediately after the last queue item, so a click during the modal close transition cannot resubmit it', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 tasks' }))

    await screen.findByRole('dialog', { name: 'Create Task (1/2)' })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await screen.findByRole('dialog', { name: 'Create Task (2/2)' })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    // Wait for the second (last) create() to resolve and advanceQueue() to run, same as the
    // "steps through" test, but instead of waiting for the dialog to fully unmount, grab the
    // Create button as soon as it's disabled - Mantine keeps the modal content mounted and
    // interactive during its close transition, so this window is real and clickable.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Create Task/ })).not.toBeInTheDocument()
    })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('skips a folder without creating a task for it, and advances to the next', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 tasks' }))

    await screen.findByRole('dialog', { name: 'Create Task (1/2)' })
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByRole('dialog', { name: 'Create Task (2/2)' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('FolderB')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('asks to confirm before stopping the sequence when the modal is closed mid-way, and "Keep going" cancels the stop', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 tasks' }))
    await screen.findByRole('dialog', { name: 'Create Task (1/2)' })

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })

    expect(await screen.findByText(/won't be imported/)).toBeInTheDocument()
    // Declining the stop leaves the in-progress step's modal open, untouched.
    expect(screen.getByRole('dialog', { name: 'Create Task (1/2)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))

    await waitFor(() => {
      expect(screen.queryByText(/won't be imported/)).not.toBeInTheDocument()
    })
    expect(screen.getByRole('dialog', { name: 'Create Task (1/2)' })).toBeInTheDocument()
  })

  it('stops the whole sequence when the stop is confirmed, creating no further tasks', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 tasks' }))
    await screen.findByRole('dialog', { name: 'Create Task (1/2)' })

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    await screen.findByText(/won't be imported/)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Create Task/ })).not.toBeInTheDocument()
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('closes immediately with no confirmation for a single (non-queued) task', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)
    await openModal()

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })

    expect(screen.queryByText(/won't be imported/)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create Task' })).not.toBeInTheDocument()
    })
  })

  it('opens nothing when the standalone picker is cancelled instead of choosing None', async () => {
    renderWithProviders(<CreateTaskButton project={project} create={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))
    await screen.findByRole('dialog', { name: /Import Samples/ })
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('combines everything into one task when the user declines the split', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton project={project} create={create} />)

    dropFiles([makeFolderFile('FolderA/img1.jpg', 1024), makeFolderFile('FolderB/img1.jpg', 1024)])
    await screen.findByText(/You dropped 2 folders/)
    fireEvent.click(screen.getByRole('button', { name: 'No, one task' }))

    const nameInput = await screen.findByLabelText('Name')
    expect(nameInput).toHaveValue('')
    expect(screen.getByText('2 files')).toBeInTheDocument()

    fireEvent.change(nameInput, { target: { value: 'Combined Batch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toBe('Combined Batch')
    expect(create.mock.calls[0][1]).toHaveLength(2)
  })

  describe('dropping a .cvlabel file', () => {
    beforeEach(() => {
      // .cvlabel parsing goes through virtualFilesFromExtractedZip (window.zip/fileUtils),
      // a different pipeline than the plain-image drop path's filesToSamples - this
      // installs the fuller fake filesystem those need, layered on top of the getFileSize/
      // getScratchPreviewUri/deleteDirectory stubs the outer beforeEach already set up for
      // the Create Task modal's own sample list and cleanup.
      installFakeFileSystem()
      window.system = {
        ...window.system,
        getScratchPreviewUri,
        deleteDirectory
      } as unknown as typeof window.system
    })

    it('drops straight into the label-mapping step, skipping the picker', async () => {
      const file = await makeCvLabelFile(
        'French Batch.cvlabel',
        [{ id: 'l1', name: 'Texte' }],
        oneCvLabelSample
      )
      renderWithProviders(<CreateTaskButton project={projectWithLabel} create={vi.fn()} />)

      dropFiles([file])

      expect(await screen.findByRole('dialog', { name: 'Import .cvlabel' })).toBeInTheDocument()
      expect(await screen.findByText('Texte')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Text')).toBeInTheDocument()
    })

    it('prefills the Create Task modal from the file name and mapped samples', async () => {
      const file = await makeCvLabelFile(
        'French Batch.cvlabel',
        [{ id: 'l1', name: 'Texte' }],
        oneCvLabelSample
      )
      const create = vi.fn().mockResolvedValue(undefined)
      renderWithProviders(<CreateTaskButton project={projectWithLabel} create={create} />)

      dropFiles([file])
      await screen.findByRole('dialog', { name: 'Import .cvlabel' })
      fireEvent.click(await screen.findByRole('button', { name: 'Import' }))

      expect(await screen.findByRole('dialog', { name: 'Create Task' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('French Batch')
      expect(await screen.findByText('photo-one')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Create' }))

      expect(create).toHaveBeenCalledTimes(1)
      expect(create.mock.calls[0][0]).toBe('French Batch')
      expect(create.mock.calls[0][1]).toHaveLength(1)
      expect(create.mock.calls[0][1][0].annotations[0].labelId).toBe('l1')
    })

    it('closes without opening Create Task when the cv-label wizard is dismissed', async () => {
      const file = await makeCvLabelFile(
        'French Batch.cvlabel',
        [{ id: 'l1', name: 'Texte' }],
        oneCvLabelSample
      )
      renderWithProviders(<CreateTaskButton project={projectWithLabel} create={vi.fn()} />)

      dropFiles([file])
      await screen.findByRole('dialog', { name: 'Import .cvlabel' })
      // The drop lands straight on the mapping step (no Cancel button there, only on the
      // picker step it skips) - dismissing via Escape exercises the modal's own onClose,
      // same as a user closing it any other way once past that first step.
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Import .cvlabel' })).not.toBeInTheDocument()
      })
      expect(screen.queryByRole('dialog', { name: 'Create Task' })).not.toBeInTheDocument()
    })

    it('starts a queue, one Create Task step per task, when the standalone picker returns multiple task groups', async () => {
      const file = await makeMultiTaskCvLabelFile('Two Batches.cvlabel', [
        { id: 'l1', name: 'Texte' }
      ])
      const create = vi.fn().mockResolvedValue(undefined)
      renderWithProviders(<CreateTaskButton project={projectWithLabel} create={create} />)

      fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))
      const importDialog = await screen.findByRole('dialog', { name: /Import Samples/ })
      fireEvent.click(within(importDialog).getByText('cv-label File'))
      const input = importDialog.querySelector('input[type=file]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(await screen.findByRole('button', { name: '2 Separate Tasks' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Import' }))

      expect(await screen.findByRole('dialog', { name: 'Create Task (1/2)' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Batch 1')
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))

      expect(await screen.findByRole('dialog', { name: 'Create Task (2/2)' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Batch 2')
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Create Task/ })).not.toBeInTheDocument()
      })
      expect(create).toHaveBeenCalledTimes(2)
      expect(create.mock.calls[0][0]).toBe('Batch 1')
      expect(create.mock.calls[1][0]).toBe('Batch 2')
    })
  })
})
