import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { RenameModal } from '../RenameModal'

describe('RenameModal', () => {
  it('starts pre-filled with the initial name', () => {
    renderWithProviders(
      <RenameModal
        opened
        entityName="task"
        initialName="Batch 1"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Name')).toHaveValue('Batch 1')
  })

  it('calls onConfirm with the trimmed new name when Save is clicked', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <RenameModal
        opened
        entityName="task"
        initialName="Batch 1"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Batch 2  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledWith('Batch 2')
  })

  it('submits on Enter', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <RenameModal
        opened
        entityName="task"
        initialName="Batch 1"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Batch 2' } })
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })

    expect(onConfirm).toHaveBeenCalledWith('Batch 2')
  })

  it('disables Save when the name is blank', () => {
    renderWithProviders(
      <RenameModal
        opened
        entityName="task"
        initialName="Batch 1"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <RenameModal
        opened
        entityName="task"
        initialName="Batch 1"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
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
      <RenameModal
        opened
        entityName="task"
        initialName="Batch 1"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    resolveConfirm?.()
  })
})
