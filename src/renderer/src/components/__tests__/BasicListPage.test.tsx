import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { BasicListPage } from '../BasicListPage'

describe('BasicListPage', () => {
  it('renders the top region and children', () => {
    renderWithProviders(
      <BasicListPage top={<div>Top content</div>}>
        <div>List content</div>
      </BasicListPage>
    )

    expect(screen.getByText('Top content')).toBeInTheDocument()
    expect(screen.getByText('List content')).toBeInTheDocument()
  })
})
