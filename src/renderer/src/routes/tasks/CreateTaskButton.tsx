import {
  Modal,
  Stack,
  TextInput,
  Flex,
  Button,
  Group,
  Text,
  ScrollArea,
  FileButton
} from '@mantine/core'
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone'
import { FC, useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { IoMdAdd } from 'react-icons/io'
import { normalizeFilename } from '@renderer/utils'

export type CreateTaskButtonProps = {
  create: (name: string, files: File[]) => Promise<void>
}

export const CreateTaskButton: FC<CreateTaskButtonProps> = ({ create }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const openModal = useCallback(() => {
    setTaskName(``)
    setIsModalOpen(true)
  }, [])

  return (
    <>
      <Dropzone.FullScreen
        active={!isModalOpen}
        accept={IMAGE_MIME_TYPE}
        onDrop={(files) => {
          setFiles(files)
          openModal()
        }}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <div>
            <Text size="xl" inline>
              Drop files or folders
            </Text>
          </div>
        </Group>
      </Dropzone.FullScreen>
      <Modal
        opened={isModalOpen}
        onClose={closeModal}
        title="Create Task"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap={'lg'}>
          <TextInput
            label="Name"
            w={500}
            placeholder="Task Name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
          <Flex justify={'flex-end'}>
            <FileButton
              onChange={(f) => {
                setFiles((s) => [...s, ...f])
              }}
              multiple
              accept="image/*"
            >
              {(props) => (
                <Button {...props} variant="outline">
                  Add Samples
                </Button>
              )}
            </FileButton>
          </Flex>
          <Flex>
            <ScrollArea
              style={{
                flexGrow: 1,
                maxHeight: '200px'
              }}
              type="always"
              scrollbars="y"
            >
              <Stack justify="center">
                {files.map((file) => (
                  <Text ta={'center'} key={`${file.name}-${file.size}-${file.lastModified}`}>
                    {normalizeFilename(file.name)}
                  </Text>
                ))}
              </Stack>
            </ScrollArea>
          </Flex>
          <Button
            fullWidth
            onClick={() => {
              toast.promise(create(taskName, files), {
                loading: 'Creating task',
                success: 'Task created',
                error: (e) => {
                  console.error(e)
                  return 'Failed to create task'
                }
              })
              setIsModalOpen(false)
            }}
            disabled={taskName.trim().length === 0}
          >
            Create
          </Button>
        </Stack>
      </Modal>
      <Button
        leftSection={<IoMdAdd />}
        onClick={() => {
          setFiles([])
          openModal()
        }}
      >
        Create Task
      </Button>
    </>
  )
}
