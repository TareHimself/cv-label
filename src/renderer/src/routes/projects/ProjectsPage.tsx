import { BasicListPage } from '@renderer/components/BasicListPage'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { EditProjectModal } from './EditProjectModal'
import { styled } from '@linaria/react'
import { Badge, Button, Divider, Group, Stack, Text, TextInput } from '@mantine/core'
import { CiSearch } from 'react-icons/ci'
import { MdDeleteOutline, MdFolder } from 'react-icons/md'
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
  const { items, create, open, update, remove, removeMany, isLoading } = useProjects()
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<IProject | null>(null)
  const [pendingEdit, setPendingEdit] = useState<IProject | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [isBatchDeletePending, setIsBatchDeletePending] = useState(false)

  // Selected projects stay visible even if a search narrows the list below them, so
  // batch actions never silently lose track of a selection the user can no longer see.
  const filteredItems = useMemo(
    () =>
      items.filter(
        (p) =>
          selectedProjectIds.has(p.id) || p.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [items, search, selectedProjectIds]
  )

  const selectedProjects = items.filter((p) => selectedProjectIds.has(p.id))

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedProjectIds(new Set())
  }

  const toggleSelected = (projectId: string, selected: boolean) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      if (selected) {
        next.add(projectId)
      } else {
        next.delete(projectId)
      }
      return next
    })
  }

  // Selection helpers operate on filteredItems (the currently visible/filtered list),
  // not the full unfiltered project list, and all three enter select mode if not already.
  const selectAll = () => {
    setIsSelectMode(true)
    setSelectedProjectIds(new Set(filteredItems.map((p) => p.id)))
  }

  const selectAbove = (index: number) => {
    setIsSelectMode(true)
    setSelectedProjectIds(new Set(filteredItems.slice(0, index + 1).map((p) => p.id)))
  }

  const selectBelow = (index: number) => {
    setIsSelectMode(true)
    setSelectedProjectIds(new Set(filteredItems.slice(index).map((p) => p.id)))
  }

  return (
    <>
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="project"
        itemName={pendingDelete?.name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => (pendingDelete !== null ? remove(pendingDelete.id) : Promise.resolve())}
      />
      <ConfirmDeleteModal
        opened={isBatchDeletePending}
        entityName="project"
        itemName={
          selectedProjects.length === 1
            ? selectedProjects[0].name
            : `${selectedProjects.length} projects`
        }
        onCancel={() => setIsBatchDeletePending(false)}
        onConfirm={() => {
          const result = removeMany(selectedProjects.map((p) => p.id))
          exitSelectMode()
          return result
        }}
      />
      <EditProjectModal
        key={pendingEdit?.id}
        opened={pendingEdit !== null}
        project={pendingEdit}
        onCancel={() => setPendingEdit(null)}
        onConfirm={(name, labels) => {
          const result =
            pendingEdit !== null ? update(pendingEdit.id, name, labels) : Promise.resolve()
          setPendingEdit(null)
          return result
        }}
      />
      <BasicListPage
        top={
          <TopContainer>
            <Group>
              <CreateProjectButton create={create} />
              {!isSelectMode && (
                <Button size="xs" variant="outline" onClick={() => setIsSelectMode(true)}>
                  Select
                </Button>
              )}
              {isSelectMode && (
                <>
                  <Divider orientation="vertical" />
                  <Text size="sm" fw={500}>
                    {selectedProjectIds.size} selected
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    leftSection={<MdDeleteOutline size={14} />}
                    disabled={selectedProjectIds.size === 0}
                    onClick={() => setIsBatchDeletePending(true)}
                  >
                    Delete
                  </Button>
                  <Button size="xs" variant="subtle" onClick={exitSelectMode}>
                    Clear
                  </Button>
                </>
              )}
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
                ? 'No projects yet, create one to get started.'
                : 'No projects match your search.'}
            </Text>
          )}
          {!isLoading &&
            filteredItems.map((p, index) => (
              <BasicListPageItem
                key={p.id}
                icon={<MdFolder size={18} />}
                title={p.name}
                subtitle={p.labels.length === 0 ? 'No labels' : undefined}
                tags={p.labels.length > 0 ? <LabelTags labels={p.labels} /> : undefined}
                onClick={() => open(p)}
                onEdit={() => setPendingEdit(p)}
                onDelete={() => setPendingDelete(p)}
                selectMode={isSelectMode}
                selected={selectedProjectIds.has(p.id)}
                onSelectedChange={(selected) => toggleSelected(p.id, selected)}
                onSelectAll={selectAll}
                onSelectAbove={() => selectAbove(index)}
                onSelectBelow={() => selectBelow(index)}
              />
            ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
