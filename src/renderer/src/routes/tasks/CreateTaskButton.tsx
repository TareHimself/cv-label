import {
  ActionIcon,
  Modal,
  Stack,
  TextInput,
  Flex,
  Button,
  Group,
  Image,
  Text,
  ScrollArea,
  FileButton
} from '@mantine/core'
import { styled } from '@linaria/react'
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone'
import { FC, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IoMdAdd } from 'react-icons/io'
import { MdDeleteOutline } from 'react-icons/md'
import { normalizeFilename } from '@renderer/utils'

export type CreateTaskButtonProps = {
  create: (name: string, files: File[]) => Promise<void>
}

const FileRow = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--mantine-radius-sm);

  &:hover {
    background-color: light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-5));
  }
`

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const SelectedFileRow: FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    // Must create and revoke within the same effect run: StrictMode's dev-only
    // mount->cleanup->remount cycle would otherwise revoke a URL created outside
    // this effect (e.g. via useMemo) without ever recreating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <FileRow>
      <Image src={previewUrl ?? undefined} w={36} h={36} radius="sm" fit="cover" />
      <Flex direction="column" flex={1} miw={0} mx="sm">
        <Text size="sm" truncate>
          {normalizeFilename(file.name)}
        </Text>
        <Text size="xs" c="dimmed">
          {formatFileSize(file.size)}
        </Text>
      </Flex>
      <ActionIcon aria-label="Remove file" variant="subtle" color="red" onClick={onRemove}>
        <MdDeleteOutline size={16} />
      </ActionIcon>
    </FileRow>
  )
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
            // w={500}
            placeholder="Task Name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
          <Flex justify={'space-between'} align={'center'}>
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
            {files.length > 0 && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  {files.length} file{files.length === 1 ? '' : 's'}
                </Text>
                <Button variant="subtle" color="red" size="xs" onClick={() => setFiles([])}>
                  Clear all
                </Button>
              </Group>
            )}
          </Flex>
          <Flex>
            <ScrollArea
              style={{
                flexGrow: 1,
                maxHeight: '260px'
              }}
              type="always"
              scrollbars="y"
            >
              {files.length === 0 ? (
                <Text ta="center" c="dimmed" size="sm" py="md">
                  No files selected yet
                </Text>
              ) : (
                <Stack gap={2}>
                  {files.map((file, idx) => (
                    <SelectedFileRow
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      file={file}
                      onRemove={() => setFiles((s) => s.filter((_, i) => i !== idx))}
                    />
                  ))}
                </Stack>
              )}
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
