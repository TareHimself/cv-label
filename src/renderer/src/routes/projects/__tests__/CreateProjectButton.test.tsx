import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { CreateProjectButton } from '../CreateProjectButton'

describe('CreateProjectButton', () => {
  it('opens the modal with one empty label row when clicked', async () => {
    renderWithProviders(<CreateProjectButton create={vi.fn()} />)

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }))

    expect(await screen.findByLabelText('Name')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('Label Name')).toHaveLength(1)
  })

  it('disables Create until a project name and all label names are filled', async () => {
    renderWithProviders(<CreateProjectButton create={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }))
    await screen.findByLabelText('Name')

    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Street Signs' } })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getAllByPlaceholderText('Label Name')[0], {
      target: { value: 'Stop Sign' }
    })
    expect(createButton).toBeEnabled()
  })

  it('calls create with the project name and labels, then closes the modal', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CreateProjectButton create={create} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }))
    await screen.findByLabelText('Name')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Street Signs' } })
    fireEvent.change(screen.getAllByPlaceholderText('Label Name')[0], {
      target: { value: 'Stop Sign' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(create).toHaveBeenCalledTimes(1)
    const [name, labels] = create.mock.calls[0]
    expect(name).toBe('Street Signs')
    expect(labels).toHaveLength(1)
    expect(labels[0]).toMatchObject({ name: 'Stop Sign' })
  })

  it('adds and removes label rows', async () => {
    renderWithProviders(<CreateProjectButton create={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }))
    await screen.findByLabelText('Name')

    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }))
    expect(screen.getAllByPlaceholderText('Label Name')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove label' })[0])
    expect(screen.getAllByPlaceholderText('Label Name')).toHaveLength(1)
  })
})
