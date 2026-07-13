import { Button, type ButtonProps } from '@mantine/core'
import { useCallback, useRef, useState, type FC } from 'react'

export type AsyncButtonProps = Omit<ButtonProps, 'loading'> & {
  onClick: () => Promise<unknown>
  /** Mirrors the internal pending state up, for callers that also need to disable sibling
   *  controls (e.g. a Cancel button or other inputs) while the async work is in flight. */
  onPendingChange?: (isPending: boolean) => void
}

/** Wraps Mantine's Button to guard against double-submit: ignores clicks while a previous
 *  onClick's promise is still pending, and shows Mantine's built-in loading state meanwhile. */
export const AsyncButton: FC<AsyncButtonProps> = ({
  onClick,
  onPendingChange,
  disabled,
  ...buttonProps
}) => {
  const [isPending, setIsPending] = useState(false)
  // The re-entrancy gate itself must be a ref, not the isPending state: several clicks
  // dispatched within the same synchronous tick (e.g. a fast native double-click) get
  // batched by React into a single re-render, so a second click's handler can still read
  // the pre-update `isPending` value from state. A ref is read/written synchronously and
  // isn't subject to that batching, so it reliably blocks same-tick re-entrant clicks.
  const isPendingRef = useRef(false)

  const handleClick = useCallback(() => {
    if (isPendingRef.current) return
    isPendingRef.current = true
    setIsPending(true)
    onPendingChange?.(true)
    // Swallow rejections on this specific derived chain only - other consumers of the same
    // promise (e.g. a caller's own try/catch, or react-hot-toast's toast.promise) still see
    // the rejection on their own branch; this just keeps our own bookkeeping from producing
    // a spurious unhandled-rejection warning when nothing else happens to be watching it.
    // Wrapped in Promise.resolve() since onClick isn't guaranteed to return a real Promise
    // (e.g. a test double that forgets to mock a resolved value).
    Promise.resolve(onClick())
      .catch(() => {})
      .finally(() => {
        isPendingRef.current = false
        setIsPending(false)
        onPendingChange?.(false)
      })
  }, [onClick, onPendingChange])

  return (
    <Button
      {...buttonProps}
      disabled={disabled || isPending}
      loading={isPending}
      onClick={handleClick}
    />
  )
}
