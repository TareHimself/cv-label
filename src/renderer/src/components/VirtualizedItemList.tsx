import { Box } from '@mantine/core'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'

export type VirtualizedItemListProps<T> = {
  items: T[]
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  /** The actual scrolling DOM element these rows live inside - see BasicListPage's scrollContainerRef. */
  scrollContainerRef: RefObject<HTMLDivElement | null>
  /** A first-paint guess before a row has ever been measured - only affects the very first layout estimate, not correctness. */
  estimateSize?: number
}

/** Renders only rows scrolled into view (plus a look-ahead buffer) so DOM cost doesn't scale with dataset size. react-virtuoso handles the non-uniform row heights (badges/progress bars) without the jump a coarser estimate would cause. */
export function VirtualizedItemList<T>({
  items,
  getKey,
  renderItem,
  scrollContainerRef,
  estimateSize = 90
}: VirtualizedItemListProps<T>) {
  // Resolved into state so Virtuoso never renders with its own fallback internal scroller before swapping to the real one.
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    setScrollParent(scrollContainerRef.current)
  }, [scrollContainerRef])
  // Catches the case where scrollContainerRef's ref hasn't attached yet when the layout effect above runs (refs attach bottom-up) - a plain effect runs after every layout effect in the commit.
  useEffect(() => {
    if (scrollParent === null) setScrollParent(scrollContainerRef.current)
  }, [scrollContainerRef, scrollParent])

  if (scrollParent === null) return null

  return (
    <Virtuoso
      customScrollParent={scrollParent}
      data={items}
      computeItemKey={(index, item) => getKey(item, index)}
      defaultItemHeight={estimateSize}
      // Look-ahead buffer in pixels, so fast scrolling is less likely to outrun measurement.
      increaseViewportBy={{ top: 400, bottom: 400 }}
      itemContent={(index, item) => <Box pb="md">{renderItem(item, index)}</Box>}
    />
  )
}
