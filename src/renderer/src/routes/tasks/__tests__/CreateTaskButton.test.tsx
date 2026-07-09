import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { CreateTaskButton } from '../CreateTaskButton'
import { IProject } from '@shared/types'

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

const project: IProject = { id: 'project-1', name: 'Test Project', labels: [] }

const makeFile = (name: string, sizeInBytes: number) => {
  const file = new File([new Uint8Array(sizeInBytes)], name, { type: 'image/jpeg' })
  return file
}

const openModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))
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
})
