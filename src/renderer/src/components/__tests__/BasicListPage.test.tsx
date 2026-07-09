import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
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

  // Regression test for a real bug: pages using this component can be hidden (not
  // unmounted) by the stack router's <Activity> boundary. That collapses this container to
  // 0x0 and fires a spurious scroll event with scrollTop 0 - simulated here via
  // defineProperty since jsdom has no real layout engine to do it for us. Restoring scroll
  // must survive that instead of clobbering the real last-known position with the 0.
  it('restores scroll position through a hide/show cycle instead of resetting to 0', () => {
    const { rerender } = renderWithProviders(
      <BasicListPage top={<div>Top</div>}>
        <div>Content</div>
      </BasicListPage>
    )
    const scrollEl = screen.getByTestId('basic-list-scroll-container')

    // Visible, user scrolls down.
    Object.defineProperty(scrollEl, 'clientHeight', { value: 200, configurable: true })
    scrollEl.scrollTop = 500
    fireEvent.scroll(scrollEl)

    // Hidden: collapses to 0x0 and fires the spurious scroll(0) event.
    Object.defineProperty(scrollEl, 'clientHeight', { value: 0, configurable: true })
    scrollEl.scrollTop = 0
    fireEvent.scroll(scrollEl)

    // Shown again: layout returns, but the browser doesn't restore scrollTop on its own.
    Object.defineProperty(scrollEl, 'clientHeight', { value: 200, configurable: true })
    scrollEl.scrollTop = 0

    rerender(
      <BasicListPage top={<div>Top</div>}>
        <div>Content</div>
      </BasicListPage>
    )

    expect(scrollEl.scrollTop).toBe(500)
  })
})
