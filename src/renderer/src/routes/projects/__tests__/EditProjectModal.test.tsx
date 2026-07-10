import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject } from '@shared/types'
import { EditProjectModal } from '../EditProjectModal'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [
    { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
    { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
  ]
}

describe('EditProjectModal', () => {
  it('starts pre-filled with the project name and label names', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(screen.getByLabelText('Name')).toHaveValue('Street Signs')
    expect(screen.getByDisplayValue('Stop Sign')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Yield Sign')).toBeInTheDocument()
  })

  it('renders nothing (no crash) when no project is set, and stays closed', () => {
    renderWithProviders(
      <EditProjectModal opened={false} project={null} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(screen.queryByText('Edit Project')).not.toBeInTheDocument()
  })

  it('calls onConfirm with the updated project name and label names', () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={onConfirm} />
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed Project' } })
    fireEvent.change(screen.getByDisplayValue('Stop Sign'), {
      target: { value: 'Stop Sign Renamed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledWith('Renamed Project', [
      { id: 'l1', name: 'Stop Sign Renamed' },
      { id: 'l2', name: 'Yield Sign' }
    ])
  })

  it('disables Save when the project name is blank', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('disables Save when a label name is blank', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    fireEvent.change(screen.getByDisplayValue('Stop Sign'), { target: { value: '  ' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('does not add or remove label rows', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(screen.queryByRole('button', { name: 'Add Label' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Remove label')).not.toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={onCancel} onConfirm={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
