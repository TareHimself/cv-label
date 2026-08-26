import { styled } from '@linaria/react'
import { Checkbox, Group, Paper, Skeleton, Text, ThemeIcon } from '@mantine/core'
import type { FC, MouseEventHandler, ReactNode } from 'react'
import {
  MdChevronRight,
  MdContentCopy,
  MdDeleteOutline,
  MdEdit,
  MdLabel,
  MdOutlineSmartToy
} from 'react-icons/md'
import { FaFileExport } from 'react-icons/fa'
import { useContextMenu } from 'mantine-contextmenu'

const ROW_PADDING = '14px 18px'

const Row = styled(Paper)`
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${ROW_PADDING};
  cursor: pointer;
  transition:
    transform 0.1s ease,
    background-color 0.1s ease;

  &:hover {
    transform: translateY(-1px);
    background-color: light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-5));
  }
`

const SkeletonRow = styled(Paper)`
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${ROW_PADDING};
`

const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin: 0px 14px;
`

export type BasicListPageItemProps = {
  icon: ReactNode
  title: string
  subtitle?: string
  tags?: ReactNode
  onClick: () => void
  onEdit?: () => void
  onManageAnnotators?: () => void
  onAutoLabel?: () => void
  onEditTags?: () => void
  /** Exports just this item - only offered outside select mode, where batch export takes over. */
  onExport?: () => void
  /** Copies this item's samples' annotations into another task - only offered outside select mode, same as onExport. */
  onCopyAnnotations?: () => void
  onDelete?: () => void
  /** While true, clicking the row anywhere toggles selection instead of firing onClick, and the checkbox becomes visible. */
  selectMode?: boolean
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  /** Enters select mode with just this item selected - the context menu's entry point into selection when nothing else is selected yet. */
  onSelect?: () => void
  /** Selects every currently visible (filtered) item. */
  onSelectAll?: () => void
  /** Selects this item and every visible item above it. */
  onSelectAbove?: () => void
  /** Selects this item and every visible item below it. */
  onSelectBelow?: () => void
}

export const BasicListPageItem: FC<BasicListPageItemProps> = ({
  icon,
  title,
  subtitle,
  tags,
  onClick,
  onEdit,
  onManageAnnotators,
  onAutoLabel,
  onEditTags,
  onExport,
  onCopyAnnotations,
  onDelete,
  selectMode,
  selected,
  onSelectedChange,
  onSelect,
  onSelectAll,
  onSelectAbove,
  onSelectBelow
}) => {
  const { showContextMenu } = useContextMenu()

  const editDeleteItems = [
    ...(onEdit
      ? [{ key: 'edit', icon: <MdEdit size={16} />, title: 'Edit', onClick: onEdit }]
      : []),
    ...(onManageAnnotators
      ? [
          {
            key: 'manage-annotators',
            icon: <MdOutlineSmartToy size={16} />,
            title: 'Manage Annotators',
            onClick: onManageAnnotators
          }
        ]
      : []),
    ...(onAutoLabel
      ? [
          {
            key: 'auto-label',
            icon: <MdOutlineSmartToy size={16} />,
            title: 'Auto-label',
            onClick: onAutoLabel
          }
        ]
      : []),
    ...(onEditTags
      ? [{ key: 'edit-tags', icon: <MdLabel size={16} />, title: 'Edit Tags', onClick: onEditTags }]
      : []),
    ...(onExport && !selectMode
      ? [{ key: 'export', icon: <FaFileExport size={16} />, title: 'Export', onClick: onExport }]
      : []),
    ...(onCopyAnnotations && !selectMode
      ? [
          {
            key: 'copy-annotations',
            icon: <MdContentCopy size={16} />,
            title: 'Copy Annotations',
            onClick: onCopyAnnotations
          }
        ]
      : []),
    ...(onDelete
      ? [
          {
            key: 'delete',
            icon: <MdDeleteOutline size={16} />,
            title: 'Delete',
            color: 'red',
            onClick: onDelete
          }
        ]
      : [])
  ]
  // Outside select mode, the All/Above/Below variants have no anchor to make sense of yet
  // (nothing else is selected) - a single generic "Select" entry (via onSelect) is the
  // only selection action offered until the list is already in select mode, at which
  // point the fuller batch-selection variants take over.
  const selectionItems = selectMode
    ? [
        ...(onSelectAll ? [{ key: 'select-all', title: 'Select All', onClick: onSelectAll }] : []),
        ...(onSelectAbove
          ? [{ key: 'select-above', title: 'Select Above', onClick: onSelectAbove }]
          : []),
        ...(onSelectBelow
          ? [{ key: 'select-below', title: 'Select Below', onClick: onSelectBelow }]
          : [])
      ]
    : onSelect
      ? [{ key: 'select', title: 'Select', onClick: onSelect }]
      : []
  const contextMenuItems = [
    ...editDeleteItems,
    ...(editDeleteItems.length > 0 && selectionItems.length > 0 ? [{ key: 'divider' }] : []),
    ...selectionItems
  ]

  const onContextMenu: MouseEventHandler<HTMLDivElement> =
    contextMenuItems.length > 0 ? showContextMenu(contextMenuItems) : () => {}

  const handleClick = () => {
    if (selectMode && onSelectedChange) {
      onSelectedChange(!selected)
    } else {
      onClick()
    }
  }

  return (
    <Row shadow="xs" withBorder onClick={handleClick} onContextMenu={onContextMenu}>
      {selectMode && onSelectedChange && (
        <Checkbox
          aria-label={`Select ${title}`}
          checked={selected ?? false}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelectedChange(e.currentTarget.checked)}
          mr="md"
        />
      )}
      <ThemeIcon variant="light" size="lg" radius="md">
        {icon}
      </ThemeIcon>
      <Info>
        <Text fw={600} truncate>
          {title}
        </Text>
        {subtitle && (
          <Text size="xs" c="dimmed" truncate>
            {subtitle}
          </Text>
        )}
        {tags}
      </Info>
      <MdChevronRight size={20} opacity={0.5} />
    </Row>
  )
}

export type BasicListPageItemSkeletonProps = {
  withTags?: boolean
}

export const BasicListPageItemSkeleton: FC<BasicListPageItemSkeletonProps> = ({ withTags }) => (
  <SkeletonRow shadow="xs" withBorder>
    <Skeleton height={34} width={34} radius="md" />
    <Info>
      <Skeleton height={14} width="35%" mb={8} />
      {withTags ? (
        <Group gap={4}>
          <Skeleton height={20} width={70} radius="sm" />
          <Skeleton height={20} width={90} radius="sm" />
        </Group>
      ) : (
        <Skeleton height={10} width="20%" />
      )}
    </Info>
    <Skeleton height={20} width={20} radius="sm" />
  </SkeletonRow>
)
