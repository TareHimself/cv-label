import { BasicListPage } from '@renderer/components/BasicListPage'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
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
  const { items, create, open, remove, removeMany, isLoading } = useTasks(project)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ITask | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false)
  const [isBatchDeletePending, setIsBatchDeletePending] = useState(false)

  const filteredItems = useMemo(
    () => items.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search]
  )

  const selectedTasks = items.filter((t) => selectedTaskIds.has(t.id))

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

  return (
    <>
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="task"
        itemName={pendingDelete?.name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete !== null) {
            remove(pendingDelete.id)
          }
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
          removeMany(selectedTasks.map((t) => t.id))
          setSelectedTaskIds(new Set())
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
              {selectedTaskIds.size > 0 && (
                <>
                  <Divider orientation="vertical" />
                  <Text size="sm" fw={500}>
                    {selectedTaskIds.size} selected
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<FaFileExport size={14} />}
                    onClick={() => setIsBatchExportOpen(true)}
                  >
                    Export
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    leftSection={<MdDeleteOutline size={14} />}
                    onClick={() => setIsBatchDeletePending(true)}
                  >
                    Delete
                  </Button>
                  <Button size="xs" variant="subtle" onClick={() => setSelectedTaskIds(new Set())}>
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
            filteredItems.map((t) => (
              <BasicListPageItem
                key={t.id}
                icon={<MdOutlineAssignment size={18} />}
                title={t.name}
                onClick={() => open(t)}
                onDelete={() => setPendingDelete(t)}
                selected={selectedTaskIds.has(t.id)}
                onSelectedChange={(selected) => toggleSelected(t.id, selected)}
              />
            ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
