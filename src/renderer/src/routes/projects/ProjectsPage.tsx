import { BasicListPage } from '@renderer/components/BasicListPage'
import { BasicListPageTopBar } from '@renderer/components/BasicListPageTopBar'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { VirtualizedItemList } from '@renderer/components/VirtualizedItemList'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { EditProjectModal } from './EditProjectModal'
import { ExportProjectModal } from './ExportProjectModal'
import { ImportProjectButton } from './ImportProjectButton'
import { AnnotatorsModal } from '@renderer/components/annotators/AnnotatorsModal'
import { Badge, Button, Divider, Group, Stack, Text, TextInput } from '@mantine/core'
import { CiSearch } from 'react-icons/ci'
import { MdDeleteOutline, MdFolder } from 'react-icons/md'
import { CreateProjectButton } from './CreateProjectButton'
import { useProjects } from '@renderer/hooks/useProjects'
import { useOnRouteLeave } from '@renderer/router/appRouter'
import { useMemo, useRef, useState } from 'react'
import { ILabel, IProject } from '@shared/types'
import tinycolor from 'tinycolor2'

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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<IProject | null>(null)
  const [pendingEdit, setPendingEdit] = useState<IProject | null>(null)
  const [pendingAnnotators, setPendingAnnotators] = useState<IProject | null>(null)
  const [pendingExport, setPendingExport] = useState<IProject | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [isBatchDeletePending, setIsBatchDeletePending] = useState(false)

  // Selected projects stay visible even if a search narrows the list below them.
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

  // Activity preserves this state across a hide/show, so it needs clearing explicitly.
  useOnRouteLeave(exitSelectMode)

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

  // The context menu's "Select" entry point outside select mode.
  const selectOnly = (projectId: string) => {
    setIsSelectMode(true)
    setSelectedProjectIds(new Set([projectId]))
  }

  // Operate on filteredItems, not the full unfiltered list, and all enter select mode if not already.
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
      {pendingAnnotators !== null && (
        <AnnotatorsModal
          opened
          project={pendingAnnotators}
          onClose={() => setPendingAnnotators(null)}
        />
      )}
      <ExportProjectModal
        opened={pendingExport !== null}
        project={pendingExport}
        onClose={() => setPendingExport(null)}
      />
      <BasicListPage
        scrollContainerRef={scrollContainerRef}
        top={
          <BasicListPageTopBar>
            <Group>
              <CreateProjectButton create={create} />
              <ImportProjectButton />
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
          </BasicListPageTopBar>
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
        </Stack>
        {!isLoading && filteredItems.length > 0 && (
          <VirtualizedItemList
            items={filteredItems}
            getKey={(p) => p.id}
            scrollContainerRef={scrollContainerRef}
            // Closer to a row with a label badge line than the generic default (90) - most projects have at least one label.
            estimateSize={80}
            renderItem={(p, index) => (
              <BasicListPageItem
                icon={<MdFolder size={18} />}
                title={p.name}
                subtitle={p.labels.length === 0 ? 'No labels' : undefined}
                tags={p.labels.length > 0 ? <LabelTags labels={p.labels} /> : undefined}
                onClick={() => open(p)}
                onEdit={() => setPendingEdit(p)}
                onManageAnnotators={() => setPendingAnnotators(p)}
                onExport={() => setPendingExport(p)}
                onDelete={() => setPendingDelete(p)}
                selectMode={isSelectMode}
                selected={selectedProjectIds.has(p.id)}
                onSelectedChange={(selected) => toggleSelected(p.id, selected)}
                onSelect={() => selectOnly(p.id)}
                onSelectAll={selectAll}
                onSelectAbove={() => selectAbove(index)}
                onSelectBelow={() => selectBelow(index)}
              />
            )}
          />
        )}
      </BasicListPage>
    </>
  )
}
