import { styled } from '@linaria/react'
import type { PropsWithChildren, FC } from 'react'

const Container = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  height: 200px;
`

export const BasicListPage: FC<PropsWithChildren> = ({ children }) => {
  return <Container>{children}</Container>
}
