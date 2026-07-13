import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AsyncButton } from '../AsyncButton'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AsyncButton', () => {
  it('renders its label and calls onClick when clicked', () => {
    const onClick = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<AsyncButton onClick={onClick}>Save</AsyncButton>)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows a loading, disabled state while the promise is pending, then re-enables on success', async () => {
    const { promise, resolve } = deferred<void>()
    const onClick = vi.fn(() => promise)
    renderWithProviders(<AsyncButton onClick={onClick}>Save</AsyncButton>)

    const button = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(button)

    expect(button).toBeDisabled()

    resolve()
    await waitFor(() => expect(button).toBeEnabled())
  })

  it('re-enables after the promise rejects, without swallowing the error for other consumers', async () => {
    const { promise, reject } = deferred<void>()
    const onClick = vi.fn(() => promise)
    renderWithProviders(<AsyncButton onClick={onClick}>Save</AsyncButton>)

    const button = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(button)
    expect(button).toBeDisabled()

    const assertionOnRejection = expect(promise).rejects.toThrow('boom')
    reject(new Error('boom'))

    await assertionOnRejection
    await waitFor(() => expect(button).toBeEnabled())
  })

  it('ignores clicks while a previous call is still pending', () => {
    const { promise, resolve } = deferred<void>()
    const onClick = vi.fn(() => promise)
    renderWithProviders(<AsyncButton onClick={onClick}>Save</AsyncButton>)

    const button = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    resolve()
  })

  it('ignores a second click dispatched in the same batch as the first (native rapid double-click)', () => {
    // Regression test: fireEvent.click() individually flushes React state between calls,
    // which masked a real bug where two clicks landing in the SAME React batch (as a fast
    // native double-click does) both read the pre-update pending state and both fired
    // onClick. Dispatching both native events inside one act() call reproduces that.
    const { promise, resolve } = deferred<void>()
    const onClick = vi.fn(() => promise)
    renderWithProviders(<AsyncButton onClick={onClick}>Save</AsyncButton>)

    const button = screen.getByRole('button', { name: 'Save' })
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(onClick).toHaveBeenCalledTimes(1)
    resolve()
  })

  it('calls onPendingChange with true then false around the click', async () => {
    const { promise, resolve } = deferred<void>()
    const onClick = vi.fn(() => promise)
    const onPendingChange = vi.fn()
    renderWithProviders(
      <AsyncButton onClick={onClick} onPendingChange={onPendingChange}>
        Save
      </AsyncButton>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onPendingChange).toHaveBeenNthCalledWith(1, true)

    resolve()
    await waitFor(() => expect(onPendingChange).toHaveBeenNthCalledWith(2, false))
  })

  it('respects an explicit disabled prop even when not pending', () => {
    const onClick = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <AsyncButton onClick={onClick} disabled>
        Save
      </AsyncButton>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).not.toHaveBeenCalled()
  })
})
