import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { CreateTaskButton } from '../CreateTaskButton'

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

const makeFile = (name: string, sizeInBytes: number) => {
  const file = new File([new Uint8Array(sizeInBytes)], name, { type: 'image/jpeg' })
  return file
}

const openModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))
  return screen.findByLabelText('Name')
}

const getFileInput = () =>
  screen
    .getByRole('dialog', { name: 'Create Task' })
    .querySelector('input[type=file]') as HTMLInputElement

describe('CreateTaskButton', () => {
  it('opens the modal showing an empty file list', async () => {
    renderWithProviders(<CreateTaskButton create={vi.fn()} />)

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

    await openModal()

    expect(screen.getByText('No files selected yet')).toBeInTheDocument()
  })

  it('lists selected files with name and size, and a running count', async () => {
    renderWithProviders(<CreateTaskButton create={vi.fn()} />)
    await openModal()

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile('photo-one.jpg', 1024), makeFile('photo-two.jpg', 2048)] }
    })

    expect(await screen.findByText('photo-one')).toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
    expect(screen.getByText('1.0 KB')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('2 files')).toBeInTheDocument()
  })

  it('removes an individual file', async () => {
    renderWithProviders(<CreateTaskButton create={vi.fn()} />)
    await openModal()

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile('photo-one.jpg', 1024), makeFile('photo-two.jpg', 2048)] }
    })
    await screen.findByText('photo-one')

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove file' })[0])

    expect(screen.queryByText('photo-one')).not.toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
    expect(screen.getByText('1 file')).toBeInTheDocument()
  })

  it('clears all files', async () => {
    renderWithProviders(<CreateTaskButton create={vi.fn()} />)
    await openModal()

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile('photo-one.jpg', 1024)] }
    })
    await screen.findByText('photo-one')

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(screen.getByText('No files selected yet')).toBeInTheDocument()
  })

  it('disables Create until a name is entered, then calls create with name and files', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateTaskButton create={create} />)
    await openModal()

    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Batch 1' } })
    expect(createButton).toBeEnabled()

    fireEvent.change(getFileInput(), { target: { files: [makeFile('photo-one.jpg', 1024)] } })
    await screen.findByText('photo-one')

    fireEvent.click(createButton)

    expect(create).toHaveBeenCalledTimes(1)
    const [name, files] = create.mock.calls[0]
    expect(name).toBe('Batch 1')
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('photo-one.jpg')
  })
})
