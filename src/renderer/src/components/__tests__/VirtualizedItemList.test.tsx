import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { useRef } from 'react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { VirtualizedItemList } from '../VirtualizedItemList'

type Item = { id: string; label: string }

const Harness = ({ items }: { items: Item[] }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={scrollContainerRef} data-testid="scroll-container" style={{ height: 400 }}>
      <VirtualizedItemList
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <div>{item.label}</div>}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
}

describe('VirtualizedItemList', () => {
  it('renders every item via renderItem', async () => {
    renderWithProviders(
      <Harness
        items={[
          { id: '1', label: 'Alpha' },
          { id: '2', label: 'Beta' }
        ]}
      />
    )
    const list = within(await screen.findByTestId('scroll-container'))

    expect(await list.findByText('Alpha')).toBeInTheDocument()
    expect(list.getByText('Beta')).toBeInTheDocument()
  })

  it('renders nothing when the list is empty', async () => {
    renderWithProviders(<Harness items={[]} />)
    const scrollContainer = await screen.findByTestId('scroll-container')

    expect(scrollContainer.textContent).toBe('')
  })

  it('reflects item updates and additions on rerender', async () => {
    const { rerender } = renderWithProviders(<Harness items={[{ id: '1', label: 'Alpha' }]} />)
    let list = within(await screen.findByTestId('scroll-container'))
    await list.findByText('Alpha')

    rerender(
      <Harness
        items={[
          { id: '1', label: 'Alpha Renamed' },
          { id: '2', label: 'Beta' }
        ]}
      />
    )

    list = within(screen.getByTestId('scroll-container'))
    expect(await list.findByText('Alpha Renamed')).toBeInTheDocument()
    expect(list.getByText('Beta')).toBeInTheDocument()
    expect(list.queryByText('Alpha')).not.toBeInTheDocument()
  })
})
