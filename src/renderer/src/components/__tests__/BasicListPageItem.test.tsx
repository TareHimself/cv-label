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

  it('shows an Edit option on right-click and calls onEdit when chosen', () => {
    const onEdit = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        onEdit={onEdit}
      />
    )

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Edit'))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('shows both Edit and Delete when both are provided, and clicking one does not trigger the other', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Delete'))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('does not show a checkbox outside select mode, even when selection props are provided', () => {
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        selected={false}
        onSelectedChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows a checkbox in select mode', () => {
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        selectMode
        selected={false}
        onSelectedChange={vi.fn()}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Select Street Signs' })).toBeInTheDocument()
  })

  it('outside select mode, clicking the row still fires onClick', () => {
    const onClick = vi.fn()
    const onSelectedChange = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={onClick}
        selected={false}
        onSelectedChange={onSelectedChange}
      />
    )

    fireEvent.click(screen.getByText('Street Signs'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSelectedChange).not.toHaveBeenCalled()
  })

  it('in select mode, clicking anywhere on the row toggles selection instead of firing onClick', () => {
    const onClick = vi.fn()
    const onSelectedChange = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={onClick}
        selectMode
        selected={false}
        onSelectedChange={onSelectedChange}
      />
    )

    fireEvent.click(screen.getByText('Street Signs'))

    expect(onSelectedChange).toHaveBeenCalledWith(true)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('in select mode, clicking the checkbox toggles selection without firing onClick', () => {
    const onClick = vi.fn()
    const onSelectedChange = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={onClick}
        selectMode
        selected={false}
        onSelectedChange={onSelectedChange}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Street Signs' }))

    expect(onSelectedChange).toHaveBeenCalledWith(true)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows Select All/Above/Below on right-click when provided, and calls the right one', () => {
    const onSelectAll = vi.fn()
    const onSelectAbove = vi.fn()
    const onSelectBelow = vi.fn()
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        onSelectAll={onSelectAll}
        onSelectAbove={onSelectAbove}
        onSelectBelow={onSelectBelow}
      />
    )

    fireEvent.contextMenu(screen.getByText('Street Signs'))
    fireEvent.click(screen.getByText('Select Above'))

    expect(onSelectAbove).toHaveBeenCalledTimes(1)
    expect(onSelectAll).not.toHaveBeenCalled()
    expect(onSelectBelow).not.toHaveBeenCalled()
  })

  it('shows both edit/delete and select-helper items together in the context menu', () => {
    renderWithProviders(
      <BasicListPageItem
        icon={<MdFolder />}
        title="Street Signs"
        onClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSelectAll={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByText('Street Signs'))

    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Select All')).toBeInTheDocument()
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
