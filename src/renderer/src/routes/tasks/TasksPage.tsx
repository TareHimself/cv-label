import { BasicListPage, BasicListPageTopBar } from '@renderer/components/BasicListPage'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { VirtualizedItemList } from '@renderer/components/VirtualizedItemList'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { RenameModal } from '@renderer/components/RenameModal'
import { AsyncButton } from '@renderer/components/AsyncButton'
import {
  Badge,
  Button,
  Divider,
  Group,
  MultiSelect,
  Progress,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import { IoMdArrowBack } from 'react-icons/io'
import { CiSearch } from 'react-icons/ci'
import { MdDeleteOutline, MdLabel, MdOutlineAssignment, MdOutlineSmartToy } from 'react-icons/md'
import { FaFileExport } from 'react-icons/fa'
import { useMemo, useRef, useState } from 'react'
import { CreateTaskButton } from './CreateTaskButton'
import { EditTaskTagsModal } from './EditTaskTagsModal'
import { BatchEditTagsModal } from './BatchEditTagsModal'
import { ManageTagsModal } from './ManageTagsModal'
import { useTasks } from '@renderer/hooks/useTasks'
import { useTags } from '@renderer/hooks/useTags'
import { useAnnotators } from '@renderer/hooks/useAnnotators'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { IProject, ITag, ITask } from '@shared/types'
import { OptimisticSample } from '@renderer/types'
import { toOptimisticSample } from '@renderer/util/toOptimisticSample'
import { ExportSamplesModal } from '@renderer/components/sampleIO/ExportSamplesModal'
import { AnnotatorsModal } from '@renderer/components/annotators/AnnotatorsModal'
import { back, navigate, useOnRouteLeave } from '@renderer/router/appRouter'

const TaskProgress = ({
  sampleCount = 0,
  completedSampleCount = 0
}: {
  sampleCount?: number
  completedSampleCount?: number
}) => {
  if (sampleCount === 0) {
    return (
      <Text size="xs" c="dimmed" mt={4}>
        No samples yet
      </Text>
    )
  }

  const percent = Math.round((completedSampleCount / sampleCount) * 100)

  return (
    <Group gap="xs" wrap="nowrap" mt={4}>
      <Progress value={percent} size="sm" style={{ flex: 1, maxWidth: 160 }} />
      <Text size="xs" c="dimmed">
        {completedSampleCount}/{sampleCount} labeled
      </Text>
    </Group>
  )
}

const TagBadges = ({ tags }: { tags: ITask['tags'] }) => {
  if (tags === undefined || tags.length === 0) return null

  return (
    <Group gap={4} mt={4}>
      {tags.map((tag) => (
        <Badge key={tag.id} size="sm" variant="light" radius="sm">
          {tag.name}
        </Badge>
      ))}
    </Group>
  )
}

export type TasksPageProps = {
  project: IProject
}

export const TasksPage = ({ project }: TasksPageProps) => {
  const { items, create, open, update, remove, removeMany, addTags, removeTags, isLoading } =
    useTasks(project)
  const { items: allTags } = useTags(project)
  const { items: annotators } = useAnnotators()
  const store = useAppStore((s) => s.store)
  const canAutoLabel = annotators.length > 0
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<ITask | null>(null)
  const [pendingRename, setPendingRename] = useState<ITask | null>(null)
  const [pendingEditTags, setPendingEditTags] = useState<ITask | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  // Covers both batch export (the toolbar button, acting on the current selection) and
  // per-task export (the context menu's single-item entry, offered outside select mode) -
  // one modal, whichever list of tasks last triggered it.
  const [exportTarget, setExportTarget] = useState<ITask[] | null>(null)
  const [isBatchDeletePending, setIsBatchDeletePending] = useState(false)
  const [isBatchTagsOpen, setIsBatchTagsOpen] = useState(false)
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false)
  const [autoLabelTarget, setAutoLabelTarget] = useState<{
    tasks: ITask[]
    samples: OptimisticSample[]
  } | null>(null)

  const tagFilterData = useMemo(
    () => allTags.map((tag) => ({ value: tag.id, label: tag.name })),
    [allTags]
  )

  // Selected tasks stay visible even if a search or tag filter narrows the list below
  // them, so batch actions never silently lose track of a selection the user can no
  // longer see.
  const filteredItems = useMemo(
    () =>
      items.filter((t) => {
        if (selectedTaskIds.has(t.id)) return true
        if (!t.name.toLowerCase().includes(search.trim().toLowerCase())) return false
        if (tagFilter.length === 0) return true
        const taskTagIds = new Set((t.tags ?? []).map((tag) => tag.id))
        return tagFilter.some((id) => taskTagIds.has(id))
      }),
    [items, search, tagFilter, selectedTaskIds]
  )

  const selectedTasks = items.filter((t) => selectedTaskIds.has(t.id))

  // Tags currently on at least one selected task - the "Remove" side of the batch modal.
  const removableTags = useMemo(() => {
    const byId = new Map<string, ITag>()
    for (const task of selectedTasks) {
      for (const tag of task.tags ?? []) {
        byId.set(tag.id, tag)
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedTasks])

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedTaskIds(new Set())
  }

  // Multiselect shouldn't still be armed when the user comes back to this page later -
  // Activity preserves this state across a hide/show, so it has to be cleared explicitly.
  useOnRouteLeave(exitSelectMode)

  const toggleSelected = (taskId: string, selected: boolean) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current)
      if (selected) {
        next.add(taskId)
      } else {
        next.delete(taskId)
      }
      return next
    })
  }

  // Enters select mode with just this one task selected - the context menu's "Select"
  // entry point outside select mode (see selectAll/selectAbove/selectBelow below for the
  // batch variants offered once already in select mode).
  const selectOnly = (taskId: string) => {
    setIsSelectMode(true)
    setSelectedTaskIds(new Set([taskId]))
  }

  // Selection helpers operate on filteredItems (the currently visible/filtered list),
  // not the full unfiltered task list, and all three enter select mode if not already in it.
  const selectAll = () => {
    setIsSelectMode(true)
    setSelectedTaskIds(new Set(filteredItems.map((t) => t.id)))
  }

  const selectAbove = (index: number) => {
    setIsSelectMode(true)
    setSelectedTaskIds(new Set(filteredItems.slice(0, index + 1).map((t) => t.id)))
  }

  const selectBelow = (index: number) => {
    setIsSelectMode(true)
    setSelectedTaskIds(new Set(filteredItems.slice(index).map((t) => t.id)))
  }

  // Fetches each task's samples fresh (this page never loads sample data otherwise) and
  // opens the AnnotatorsModal run flow against all of them at once - lets a batch of tasks
  // get auto-labeled without opening each one's Samples page individually.
  const runAutoLabelOn = async (tasksToRun: ITask[]) => {
    const samplesByTask = await Promise.all(tasksToRun.map((t) => store.getSamplesForTask(t.id)))
    setAutoLabelTarget({
      tasks: tasksToRun,
      samples: samplesByTask.flat().map(toOptimisticSample)
    })
  }

  return (
    <>
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="task"
        itemName={pendingDelete?.name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => (pendingDelete !== null ? remove(pendingDelete.id) : Promise.resolve())}
      />
      <RenameModal
        key={pendingRename?.id}
        opened={pendingRename !== null}
        entityName="task"
        initialName={pendingRename?.name ?? ''}
        onCancel={() => setPendingRename(null)}
        onConfirm={(name) => {
          const result = pendingRename !== null ? update(pendingRename.id, name) : Promise.resolve()
          setPendingRename(null)
          return result
        }}
      />
      <ConfirmDeleteModal
        opened={isBatchDeletePending}
        entityName="task"
        itemName={
          selectedTasks.length === 1 ? selectedTasks[0].name : `${selectedTasks.length} tasks`
        }
        onCancel={() => setIsBatchDeletePending(false)}
        onConfirm={() => {
          const result = removeMany(selectedTasks.map((t) => t.id))
          exitSelectMode()
          return result
        }}
      />
      <ExportSamplesModal
        opened={exportTarget !== null}
        project={project}
        tasks={exportTarget ?? []}
        onClose={() => setExportTarget(null)}
      />
      <ManageTagsModal
        opened={isManageTagsOpen}
        project={project}
        onClose={() => setIsManageTagsOpen(false)}
      />
      <EditTaskTagsModal
        key={pendingEditTags?.id}
        opened={pendingEditTags !== null}
        project={project}
        task={pendingEditTags}
        onCancel={() => setPendingEditTags(null)}
        onConfirm={async (added, removed) => {
          if (pendingEditTags === null) return
          await Promise.all([
            addTags([pendingEditTags.id], added),
            removeTags([pendingEditTags.id], removed)
          ])
          setPendingEditTags(null)
        }}
      />
      <BatchEditTagsModal
        opened={isBatchTagsOpen}
        project={project}
        taskCount={selectedTasks.length}
        removableTags={removableTags}
        onCancel={() => setIsBatchTagsOpen(false)}
        onConfirm={async (added, removed) => {
          const taskIds = selectedTasks.map((t) => t.id)
          await Promise.all([addTags(taskIds, added), removeTags(taskIds, removed)])
          setIsBatchTagsOpen(false)
        }}
      />
      {autoLabelTarget !== null && (
        <AnnotatorsModal
          opened
          project={project}
          tasks={autoLabelTarget.tasks}
          samples={autoLabelTarget.samples}
          onClose={() => setAutoLabelTarget(null)}
        />
      )}
      <BasicListPage
        scrollContainerRef={scrollContainerRef}
        top={
          <BasicListPageTopBar>
            <Group>
              <Button
                leftSection={<IoMdArrowBack />}
                variant="outline"
                onClick={() => {
                  back()
                }}
              >
                Back
              </Button>
              <CreateTaskButton project={project} create={create} />
              <Button
                size="xs"
                variant="outline"
                leftSection={<MdLabel size={14} />}
                onClick={() => setIsManageTagsOpen(true)}
              >
                Manage Tags
              </Button>
              {!isSelectMode && (
                <Button size="xs" variant="outline" onClick={() => setIsSelectMode(true)}>
                  Select
                </Button>
              )}
              {isSelectMode && (
                <>
                  <Divider orientation="vertical" />
                  <Text size="sm" fw={500}>
                    {selectedTaskIds.size} selected
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<FaFileExport size={14} />}
                    disabled={selectedTaskIds.size === 0}
                    onClick={() => setExportTarget(selectedTasks)}
                  >
                    Export
                  </Button>
                  {canAutoLabel && (
                    <AsyncButton
                      size="xs"
                      variant="outline"
                      leftSection={<MdOutlineSmartToy size={14} />}
                      disabled={selectedTaskIds.size === 0}
                      onClick={() => runAutoLabelOn(selectedTasks)}
                    >
                      Auto-label
                    </AsyncButton>
                  )}
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<MdLabel size={14} />}
                    disabled={selectedTaskIds.size === 0}
                    onClick={() => setIsBatchTagsOpen(true)}
                  >
                    Tags
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    leftSection={<MdDeleteOutline size={14} />}
                    disabled={selectedTaskIds.size === 0}
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
              {allTags.length > 0 && (
                <MultiSelect
                  placeholder="Filter by tag"
                  data={tagFilterData}
                  value={tagFilter}
                  onChange={setTagFilter}
                  clearable
                  w={220}
                />
              )}
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
              <BasicListPageItemSkeleton />
              <BasicListPageItemSkeleton />
              <BasicListPageItemSkeleton />
              <BasicListPageItemSkeleton />
              <BasicListPageItemSkeleton />
            </>
          )}
          {!isLoading && filteredItems.length === 0 && (
            <Text c="dimmed" ta="center" mt="xl">
              {items.length === 0
                ? 'No tasks yet, create one to get started.'
                : 'No tasks match your search.'}
            </Text>
          )}
        </Stack>
        {!isLoading && filteredItems.length > 0 && (
          <VirtualizedItemList
            items={filteredItems}
            getKey={(t) => t.id}
            scrollContainerRef={scrollContainerRef}
            // Closer to a row with both a tag line and the progress line than the
            // component's generic default (90) - every task row shows progress, and
            // most show tags too.
            estimateSize={104}
            renderItem={(t, index) => (
              <BasicListPageItem
                icon={<MdOutlineAssignment size={18} />}
                title={t.name}
                tags={
                  <>
                    <TagBadges tags={t.tags} />
                    <TaskProgress
                      sampleCount={t.sampleCount}
                      completedSampleCount={t.completedSampleCount}
                    />
                  </>
                }
                onClick={() => open(t)}
                onEdit={() => setPendingRename(t)}
                onAutoLabel={canAutoLabel ? () => runAutoLabelOn([t]) : undefined}
                onEditTags={() => setPendingEditTags(t)}
                onExport={() => setExportTarget([t])}
                onCopyAnnotations={() => navigate('copy-annotations', { project, sourceTask: t })}
                onDelete={() => setPendingDelete(t)}
                selectMode={isSelectMode}
                selected={selectedTaskIds.has(t.id)}
                onSelectedChange={(selected) => toggleSelected(t.id, selected)}
                onSelect={() => selectOnly(t.id)}
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
