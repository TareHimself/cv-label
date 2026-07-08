import { BasicListPage } from '@renderer/components/BasicListPage'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { styled } from '@linaria/react'
import { Badge, Group, Stack, Text, TextInput } from '@mantine/core'
import { CiSearch } from 'react-icons/ci'
import { MdFolder } from 'react-icons/md'
import { CreateProjectButton } from './CreateProjectButton'
import { useProjects } from '@renderer/hooks/useProjects'
import { useMemo, useState } from 'react'
import { ILabel, IProject } from '@shared/types'
import tinycolor from 'tinycolor2'

const TopContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`

const LabelTags = ({ labels }: { labels: ILabel[] }) => (
  <Group gap={4} mt={4}>
    <Text size="xs" c="dimmed">
      Labels:
    </Text>
    {labels.map((label) => (
      <Badge
        key={label.id}
        size="sm"
        variant="filled"
        radius="sm"
        style={{
          backgroundColor: label.color,
          color: tinycolor(label.color).isLight() ? '#000' : '#fff'
        }}
      >
        {label.name}
      </Badge>
    ))}
  </Group>
)

export const ProjectsPage = () => {
  const { items, create, open, remove, isLoading } = useProjects()
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<IProject | null>(null)

  const filteredItems = useMemo(
    () => items.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search]
  )

  return (
    <>
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="project"
        itemName={pendingDelete?.name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete !== null) {
            remove(pendingDelete.id)
          }
        }}
      />
      <BasicListPage
        top={
          <TopContainer>
            <Group>
              <CreateProjectButton create={create} />
            </Group>
            <Group>
              <TextInput
                placeholder="Search"
                rightSection={<CiSearch />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Group>
          </TopContainer>
        }
      >
        <Stack>
          {isLoading && (
            <>
              <BasicListPageItemSkeleton withTags />
              <BasicListPageItemSkeleton withTags />
              <BasicListPageItemSkeleton withTags />
              <BasicListPageItemSkeleton withTags />
              <BasicListPageItemSkeleton withTags />
            </>
          )}
          {!isLoading && filteredItems.length === 0 && (
            <Text c="dimmed" ta="center" mt="xl">
              {items.length === 0
                ? 'No projects yet — create one to get started.'
                : 'No projects match your search.'}
            </Text>
          )}
          {!isLoading &&
            filteredItems.map((p) => (
              <BasicListPageItem
                key={p.id}
                icon={<MdFolder size={18} />}
                title={p.name}
                subtitle={p.labels.length === 0 ? 'No labels' : undefined}
                tags={p.labels.length > 0 ? <LabelTags labels={p.labels} /> : undefined}
                onClick={() => open(p)}
                onDelete={() => setPendingDelete(p)}
              />
            ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
