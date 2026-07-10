import { styled } from '@linaria/react'
import { Checkbox, Group, Paper, Skeleton, Text, ThemeIcon } from '@mantine/core'
import type { FC, MouseEventHandler, ReactNode } from 'react'
import { MdChevronRight, MdDeleteOutline, MdEdit } from 'react-icons/md'
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
  onDelete?: () => void
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
}

export const BasicListPageItem: FC<BasicListPageItemProps> = ({
  icon,
  title,
  subtitle,
  tags,
  onClick,
  onEdit,
  onDelete,
  selected,
  onSelectedChange
}) => {
  const { showContextMenu } = useContextMenu()

  const contextMenuItems = [
    ...(onEdit
      ? [{ key: 'edit', icon: <MdEdit size={16} />, title: 'Edit', onClick: onEdit }]
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

  const onContextMenu: MouseEventHandler<HTMLDivElement> =
    contextMenuItems.length > 0 ? showContextMenu(contextMenuItems) : () => {}

  return (
    <Row shadow="xs" withBorder onClick={onClick} onContextMenu={onContextMenu}>
      {onSelectedChange && (
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
