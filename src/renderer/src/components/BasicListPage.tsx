import { styled } from '@linaria/react'
import { Flex, Space } from '@mantine/core'
import { useLayoutEffect, useRef, type PropsWithChildren, type FC, type ReactNode } from 'react'

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

// A plain native overflow container instead of Mantine's <ScrollArea>: pages here can be
// hidden (not unmounted) by the stack router's <Activity> boundary. Neither ScrollArea's
// JS-managed scrollbar nor the browser reliably keeps scrollTop through that: a flex child
// with min-height:0 whose ancestor toggles display:none loses its scroll offset once shown
// again, even though the DOM node itself survives. So scroll position is saved/restored
// manually below instead of trusted to survive the hide/show cycle on its own.
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
}

export const BasicListPage: FC<PropsWithChildren<BasicListPageProps>> = ({ children, top }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)

  // Restores scrollTop on setup (mount, and the resetup that happens when this page's
  // <Activity> boundary goes from hidden back to visible - see the ScrollContainer comment).
  // The value itself is captured continuously via onScroll below rather than in this effect's
  // cleanup: cleanup runs after the hide transition's DOM mutation (display:none) already
  // applied, so by then scrollTop already reads back as the collapsed 0, not the real value.
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTopRef.current
    }
  })

  return (
    <Container>
      <Flex direction={'column'} w={'100%'} h={'100%'} align={'center'}>
        <TopArea>{top}</TopArea>
        <Space h="md" />
        <ScrollContainer
          ref={scrollRef}
          data-testid="basic-list-scroll-container"
          onScroll={(e) => {
            const el = e.currentTarget
            // Hiding this page collapses it to 0x0 and fires a spurious scroll event with
            // scrollTop 0 as a side effect - ignore that rather than clobbering the real
            // last-known position with it.
            if (el.clientHeight === 0) return
            scrollTopRef.current = el.scrollTop
          }}
        >
          <ContentArea>{children}</ContentArea>
        </ScrollContainer>
      </Flex>
    </Container>
  )
}
