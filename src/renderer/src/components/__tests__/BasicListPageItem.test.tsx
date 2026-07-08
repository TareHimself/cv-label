import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { BasicListPageItem, BasicListPageItemSkeleton } from '../BasicListPageItem'
import { MdFolder } from 'react-icons/md'

describe('BasicListPageItem', () => {
  it('renders the title, subtitle and tags', () => {
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        subtitle="No labels"
        tags={<span>tag-content</span>}
        onClick={vi.fn()}
      />
    )

    expect(screen.getByText('Street Signs')).toBeInTheDocument()
    expect(screen.getByText('No labels')).toBeInTheDocument()
    expect(screen.getByText('tag-content')).toBeInTheDocument()
  })

  it('calls onClick when the row is clicked', () => {
    const onClick = vi.fn()
    renderWithProviders(
      <BasicListPageItem icon={<MdFolder />} title="Street Signs" onClick={onClick} />
    )

    fireEvent.click(screen.getByText('Street Signs'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows a Delete option on right-click and calls onDelete when chosen', () => {
    const onDelete = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        onDelete={onDelete}
      />
    )

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Delete'))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('does not show a context menu when onDelete is not provided', () => {
    renderWithProviders(
      <BasicListPageItem icon={<MdFolder />} title="Street Signs" onClick={vi.fn()} />
    )

    fireEvent.contextMenu(screen.getByText('Street Signs'))

    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })
})

describe('BasicListPageItemSkeleton', () => {
  it('renders a tag-shaped placeholder row when withTags is set', () => {
    const { container: withTags } = renderWithProviders(<BasicListPageItemSkeleton withTags />)
    const { container: withoutTags } = renderWithProviders(<BasicListPageItemSkeleton />)

    // withTags renders 2 extra pill skeletons alongside the title/icon/action ones.
    const withTagsCount = withTags.querySelectorAll('.mantine-Skeleton-root').length
    const withoutTagsCount = withoutTags.querySelectorAll('.mantine-Skeleton-root').length
    expect(withTagsCount).toBeGreaterThan(withoutTagsCount)
  })
})
