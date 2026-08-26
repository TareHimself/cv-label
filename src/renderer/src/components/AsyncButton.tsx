import { Button, type ButtonProps } from '@mantine/core'
import { useCallback, useRef, useState, type FC } from 'react'

export type AsyncButtonProps = Omit<ButtonProps, 'loading'> & {
  onClick: () => Promise<unknown>
  /** Mirrors the internal pending state up, for callers that also need to disable sibling controls while the async work is in flight. */
  onPendingChange?: (isPending: boolean) => void
}

/** Wraps Mantine's Button to guard against double-submit - ignores clicks while a previous onClick's promise is still pending. */
export const AsyncButton: FC<AsyncButtonProps> = ({
  onClick,
  onPendingChange,
  disabled,
  ...buttonProps
}) => {
  const [isPending, setIsPending] = useState(false)
  // Must be a ref, not isPending state - React batches same-tick clicks (e.g. a fast double-click) into one re-render, so state would still read stale on the second click.
  const isPendingRef = useRef(false)

  const handleClick = useCallback(() => {
    if (isPendingRef.current) return
    isPendingRef.current = true
    setIsPending(true)
    onPendingChange?.(true)
    // Swallows rejections on this derived chain only - other consumers of the same promise still see it. Promise.resolve() guards a test double that forgets to return one.
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
