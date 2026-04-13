import { BasicListPage } from '@renderer/components/BasicListPage'
import { styled } from '@linaria/react'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { IoMdArrowBack } from 'react-icons/io'
import { CiSearch } from 'react-icons/ci'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { CreateTaskButton } from './CreateTaskButton'
import { useTasks } from '@renderer/hooks/useTasks'

const TopContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`

export const TasksPage = () => {
  const { items, create, open } = useTasks()
  const navigate = useNavigate()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  return (
    <>
      <Modal
        opened={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
        }}
        title="Create Task"
        centered
      >
        <Stack>
          <TextInput label="Task Name" />
        </Stack>
      </Modal>
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
              <TextInput placeholder="Search" rightSection={<CiSearch />} />
            </Group>
          </TopContainer>
        }
      >
        <Stack>
          {items.map((t) => (
            <Button
              key={t.id}
              onClick={() => {
                open(t)
              }}
            >
              {t.name}
            </Button>
          ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
