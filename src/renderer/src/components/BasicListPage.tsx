import { styled } from '@linaria/react'
import { Flex, Space } from '@mantine/core'
import {
  useLayoutEffect,
  useRef,
  type PropsWithChildren,
  type FC,
  type ReactNode,
  type RefObject
} from 'react'

const TopArea = styled.div`
  display: flex;
  box-sizing: border-box;
  width: 60%;
  max-width: 1000px;
  /* padding: 0% max(20%, 100px); */
`

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 60%;
  max-width: 1000px;
  /* padding: 0% max(20%, 100px); */
`
const Container = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: stretch;
  padding: 50px 0px;
  box-sizing: border-box;
`

// A plain native overflow container, not Mantine's <ScrollArea> - neither it nor the browser reliably keeps scrollTop when this page's <Activity> hides it, so scroll position is saved/restored manually below.
const ScrollContainer = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
`

export type BasicListPageProps = {
  top: ReactNode
  /** Lets a caller share this page's scroll element with something outside it - a virtualizer (see VirtualizedItemList) needs the actual scrolling DOM node. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  /** Relaxes the default 60%/1000px column cap to 90%/1400px, for a page that genuinely needs more room than a plain list (e.g. CopyAnnotationsPage). */
  wide?: boolean
}

export const BasicListPage: FC<PropsWithChildren<BasicListPageProps>> = ({
  children,
  top,
  scrollContainerRef,
  wide
}) => {
  const ownScrollRef = useRef<HTMLDivElement>(null)
  const scrollRef = scrollContainerRef ?? ownScrollRef
  const scrollTopRef = useRef(0)
  const widthStyle = wide ? { width: '90%', maxWidth: 1400 } : undefined

  // Restores scrollTop on mount/hidden->visible; captured via onScroll below since cleanup runs too late (scrollTop already reads 0 by then).
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTopRef.current
    }
  })

  return (
    <Container>
      <Flex direction={'column'} w={'100%'} h={'100%'} align={'center'}>
        <TopArea style={widthStyle}>{top}</TopArea>
        <Space h="md" />
        <ScrollContainer
          ref={scrollRef}
          data-testid="basic-list-scroll-container"
          onScroll={(e) => {
            const el = e.currentTarget
            // Hiding this page collapses it to 0x0 and fires a spurious scroll(0) - ignore it.
            if (el.clientHeight === 0) return
            scrollTopRef.current = el.scrollTop
          }}
        >
          <ContentArea style={widthStyle}>{children}</ContentArea>
        </ScrollContainer>
      </Flex>
    </Container>
  )
}
