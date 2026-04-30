import { styled } from '@linaria/react'
import { Flex, ScrollArea, Space } from '@mantine/core'
import type { PropsWithChildren, FC, ReactNode } from 'react'

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

export type BasicListPageProps = {
  top: ReactNode
}

export const BasicListPage: FC<PropsWithChildren<BasicListPageProps>> = ({ children, top }) => {
  return (
    <Container>
      <Flex direction={'column'} w={'100%'} h={'100%'} align={'center'}>
        <TopArea>{top}</TopArea>
        <Space h="md" />
        <ScrollArea w={'100%'}>
          <Flex w={'100%'} align={'center'} direction={'column'}>
            <ContentArea>{children}</ContentArea>
          </Flex>
        </ScrollArea>
      </Flex>
    </Container>
  )
}
