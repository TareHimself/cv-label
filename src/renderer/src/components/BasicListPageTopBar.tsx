import { styled } from '@linaria/react'

// Shared by every list page's toolbar (Projects/Tasks/Samples): a left-hand action-button
// group and a right-hand filter/search group. flex-wrap lets the right group drop to its
// own line instead of being squeezed off-screen once the left group grows past one row
// (e.g. select mode's batch action buttons) - TopArea's fixed width doesn't grow with them.
export const BasicListPageTopBar = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`
