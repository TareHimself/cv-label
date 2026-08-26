import { styled } from '@linaria/react'

// Shared by every list page's toolbar - flex-wrap lets the right group drop to its own line instead of getting squeezed off-screen once the left group (e.g. select mode's buttons) grows past one row.
export const BasicListPageTopBar = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`
