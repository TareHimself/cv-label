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

  it('calls onConfirm with the updated project name, label names, and unchanged label colors', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={onConfirm} />
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed Project' } })
    fireEvent.change(screen.getByDisplayValue('Stop Sign'), {
      target: { value: 'Stop Sign Renamed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledWith('Renamed Project', [
      { id: 'l1', name: 'Stop Sign Renamed', color: '#ff0000' },
      { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
    ])
  })

  it('calls onConfirm with an updated label color', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={onConfirm} />
    )

    const stopSignRow = screen.getByDisplayValue('Stop Sign').closest('.mantine-TextInput-root')
    const colorInput = (stopSignRow as HTMLElement).querySelector(
      'input[type="color"]'
    ) as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledWith('Street Signs', [
      { id: 'l1', name: 'Stop Sign', color: '#123456' },
      { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
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

  it('does not offer to remove an existing label', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(screen.queryByRole('button', { name: /^Remove /i })).not.toBeInTheDocument()
  })

  it('adds a new label via Add Label and includes it on Save', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={onConfirm} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }))
    // Every label row shares the "Label Name" placeholder (existing rows just don't show
    // it, since they already have a value) - the new one is the last row appended.
    const labelInputsBeforeEdit = screen.getAllByPlaceholderText('Label Name')
    fireEvent.change(labelInputsBeforeEdit[labelInputsBeforeEdit.length - 1], {
      target: { value: 'Speed Limit' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [savedName, savedLabels] = onConfirm.mock.calls[0]
    expect(savedName).toBe('Street Signs')
    expect(savedLabels).toHaveLength(3)
    expect(savedLabels.slice(0, 2)).toEqual(project.labels)
    expect(savedLabels[2]).toMatchObject({ name: 'Speed Limit' })
  })

  it('can remove a newly-added label before saving, but not an existing one', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    // 2 existing labels to start with.
    expect(screen.getAllByPlaceholderText('Label Name')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }))
    expect(screen.getAllByPlaceholderText('Label Name')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Remove label' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove label' }))

    expect(screen.getAllByPlaceholderText('Label Name')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /^Remove /i })).not.toBeInTheDocument()
  })

  it('disables Save when a newly-added label is left blank', () => {
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={onCancel} onConfirm={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores a second click while the first onConfirm is still pending', () => {
    let resolveConfirm: (() => void) | undefined
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve
        })
    )
    renderWithProviders(
      <EditProjectModal opened project={project} onCancel={vi.fn()} onConfirm={onConfirm} />
    )

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    resolveConfirm?.()
  })
})
