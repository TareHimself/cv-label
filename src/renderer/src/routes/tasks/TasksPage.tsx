import { BasicListPage } from '@renderer/components/BasicListPage'
import {
  BasicListPageItem,
  BasicListPageItemSkeleton
} from '@renderer/components/BasicListPageItem'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { styled } from '@linaria/react'
import { Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { IoMdArrowBack } from 'react-icons/io'
import { CiSearch } from 'react-icons/ci'
import { MdOutlineAssignment } from 'react-icons/md'
import { useNavigate } from 'react-router'
import { useMemo, useState } from 'react'
import { CreateTaskButton } from './CreateTaskButton'
import { useTasks } from '@renderer/hooks/useTasks'
import { ITask } from '@shared/types'

const TopContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`

export const TasksPage = () => {
  const { items, create, open, remove, isLoading } = useTasks()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ITask | null>(null)

  const filteredItems = useMemo(
    () => items.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search]
  )

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
      <BasicListPage
        top={
          <TopContainer>
            <Group>
              <Button
                leftSection={<IoMdArrowBack />}
                variant="outline"
                onClick={() => {
                  navigate(-1)
                }}
              >
                Back
              </Button>
              <CreateTaskButton create={create} />
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
                ? 'No tasks yet — create one to get started.'
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
              />
            ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
