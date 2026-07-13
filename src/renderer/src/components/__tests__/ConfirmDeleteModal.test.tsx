import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { ConfirmDeleteModal } from '../ConfirmDeleteModal'

describe('ConfirmDeleteModal', () => {
  it('renders nothing meaningful when closed', () => {
    renderWithProviders(
      <ConfirmDeleteModal
        opened={false}
        entityName="project"
        itemName="Street Signs"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.queryByText('Delete project')).not.toBeInTheDocument()
  })

  it('shows the entity name in the title and the item name in the body', () => {
    renderWithProviders(
      <ConfirmDeleteModal
        opened
        entityName="project"
        itemName="Street Signs"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText('Delete project')).toBeInTheDocument()
    expect(screen.getByText('Street Signs')).toBeInTheDocument()
  })

  it('falls back to generic wording when no itemName is given', () => {
    renderWithProviders(
      <ConfirmDeleteModal opened entityName="task" onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(
      screen.getByText('Are you sure you want to delete this task? This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('calls only onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderWithProviders(
      <ConfirmDeleteModal
        opened
        entityName="project"
        itemName="Street Signs"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm then onCancel when Delete is clicked', () => {
    const calls: string[] = []
    const onCancel = vi.fn(() => calls.push('cancel'))
    const onConfirm = vi.fn(() => {
      calls.push('confirm')
      return Promise.resolve()
    })
    renderWithProviders(
      <ConfirmDeleteModal
        opened
        entityName="project"
        itemName="Street Signs"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(calls).toEqual(['confirm', 'cancel'])
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
      <ConfirmDeleteModal
        opened
        entityName="project"
        itemName="Street Signs"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButton)
    fireEvent.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    resolveConfirm?.()
  })
})
