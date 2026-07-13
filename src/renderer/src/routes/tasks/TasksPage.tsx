import { BasicListPage } from '@renderer/components/BasicListPage'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { RenameModal } from '@renderer/components/RenameModal'
import { styled } from '@linaria/react'
import { Button, Divider, Group, Stack, Text, TextInput } from '@mantine/core'
import { IoMdArrowBack } from 'react-icons/io'
import { CiSearch } from 'react-icons/ci'
import { MdDeleteOutline, MdOutlineAssignment } from 'react-icons/md'
import { FaFileExport } from 'react-icons/fa'
import { useMemo, useState } from 'react'
import { CreateTaskButton } from './CreateTaskButton'
import { useTasks } from '@renderer/hooks/useTasks'
import { IProject, ITask } from '@shared/types'
import { ExportSamplesModal } from '@renderer/components/sampleIO/ExportSamplesModal'
import { back } from '@renderer/router/appRouter'

const TopContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`

export type TasksPageProps = {
  project: IProject
}

export const TasksPage = ({ project }: TasksPageProps) => {
  const { items, create, open, update, remove, removeMany, isLoading } = useTasks(project)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ITask | null>(null)
  const [pendingRename, setPendingRename] = useState<ITask | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false)
  const [isBatchDeletePending, setIsBatchDeletePending] = useState(false)

  // Selected tasks stay visible even if a search narrows the list below them, so batch
  // actions never silently lose track of a selection the user can no longer see.
  const filteredItems = useMemo(
    () =>
      items.filter(
        (t) =>
          selectedTaskIds.has(t.id) || t.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [items, search, selectedTaskIds]
  )

  const selectedTasks = items.filter((t) => selectedTaskIds.has(t.id))

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedTaskIds(new Set())
  }

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
        opened={isBatchExportOpen}
        project={project}
        tasks={selectedTasks}
        onClose={() => setIsBatchExportOpen(false)}
      />
      <BasicListPage
        top={
          <TopContainer>
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
                    onClick={() => setIsBatchExportOpen(true)}
                  >
                    Export
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
          {!isLoading &&
            filteredItems.map((t, index) => (
              <BasicListPageItem
                key={t.id}
                icon={<MdOutlineAssignment size={18} />}
                title={t.name}
                onClick={() => open(t)}
                onEdit={() => setPendingRename(t)}
                onDelete={() => setPendingDelete(t)}
                selectMode={isSelectMode}
                selected={selectedTaskIds.has(t.id)}
                onSelectedChange={(selected) => toggleSelected(t.id, selected)}
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
