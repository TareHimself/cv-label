import { Box } from '@mantine/core'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'

export type VirtualizedItemListProps<T> = {
  items: T[]
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  /** The actual scrolling DOM element these rows live inside - see
   *  BasicListPage's scrollContainerRef. */
  scrollContainerRef: RefObject<HTMLDivElement | null>
  /** A first-paint guess before a row has ever been measured - rows are re-measured
   *  after mount, so this only affects the very first layout/scrollbar-size estimate,
   *  not correctness. */
  estimateSize?: number
}

/** Renders only the rows currently scrolled into view (plus a look-ahead buffer)
 *  instead of the full list - the DOM cost of a `BasicListPageItem` row (icon, tags,
 *  progress bar, context menu) doesn't scale with dataset size this way. Row heights
 *  aren't uniform (badges/progress bars add lines) - react-virtuoso (rather than
 *  @tanstack/react-virtual, which this used previously) is built specifically to
 *  measure/reflow variable-height rows without the visible jump a coarser estimate
 *  can cause when fast scrolling outruns measurement. */
export function VirtualizedItemList<T>({
  items,
  getKey,
  renderItem,
  scrollContainerRef,
  estimateSize = 90
}: VirtualizedItemListProps<T>) {
  // scrollContainerRef.current is still null during this render (refs attach at
  // commit, same as any other ref) - resolve it into state so Virtuoso never has a
  // render where it falls back to creating its own internal scroller before swapping
  // to the real one (BasicListPage's ScrollContainer, which also owns manual
  // scrollTop save/restore across this page's Activity hide/show).
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    setScrollParent(scrollContainerRef.current)
  }, [scrollContainerRef])
  // If scrollContainerRef's owner is an ancestor that mounts in this same commit
  // (rather than one already mounted from an earlier commit, e.g. behind a loading
  // gate), its ref isn't attached yet when the layout effect above runs - refs attach
  // bottom-up, so a descendant's layout effect can fire before an ancestor's own ref
  // does. A plain effect runs strictly after every layout effect in the commit has
  // finished (including that ancestor's), so it's guaranteed to see the real value
  // once the layout-effect attempt above came back empty.
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
      // Look-ahead buffer, in pixels: measures/renders rows before they're ever
      // visible, so fast scrolling is less likely to outrun measurement.
      increaseViewportBy={{ top: 400, bottom: 400 }}
      itemContent={(index, item) => <Box pb="md">{renderItem(item, index)}</Box>}
    />
  )
}
