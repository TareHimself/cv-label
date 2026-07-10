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
  ScrollArea
} from '@mantine/core'
import { styled } from '@linaria/react'
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone'
import { FC, memo, useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { IoMdAdd } from 'react-icons/io'
import { MdDeleteOutline } from 'react-icons/md'
import { INewSample, IProject } from '@shared/types'
import { ImportSamplesModal } from '@renderer/components/sampleIO/ImportSamplesModal'
import { filesToSamples } from '@renderer/components/sampleIO/importers/filesToSamples'

export type CreateTaskButtonProps = {
  project: IProject
  create: (name: string, samples: INewSample[]) => Promise<void>
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

const SelectedSampleRow = memo(function SelectedSampleRow({
  sample,
  onRemove
}: {
  sample: INewSample
  onRemove: () => void
}) {
  return (
    <FileRow>
      <Image
        src={`data:image/png;base64,${sample.base64Image}`}
        w={36}
        h={36}
        radius="sm"
        fit="cover"
      />
      <Flex direction="column" flex={1} miw={0} mx="sm">
        <Text size="sm" truncate>
          {sample.name}
        </Text>
        <Text size="xs" c="dimmed">
          {formatFileSize(Math.floor((sample.base64Image.length * 3) / 4))}
        </Text>
      </Flex>
      <ActionIcon aria-label="Remove file" variant="subtle" color="red" onClick={onRemove}>
        <MdDeleteOutline size={16} />
      </ActionIcon>
    </FileRow>
  )
})

/** Memoized so typing in the task name field (which lives in the same parent state as
 *  `samples`) doesn't re-render every imported sample's row - each one holds a full
 *  base64-encoded image, so with a large import that re-render was visibly laggy. */
const SampleList = memo(function SampleList({
  samples,
  onAddSamples,
  onRemoveSample,
  onClearSamples
}: {
  samples: INewSample[]
  onAddSamples: () => void
  onRemoveSample: (id: string) => void
  onClearSamples: () => void
}) {
  return (
    <>
      <Flex justify={'space-between'} align={'center'}>
        <Button variant="outline" onClick={onAddSamples}>
          Add Samples
        </Button>
        {samples.length > 0 && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {samples.length} file{samples.length === 1 ? '' : 's'}
            </Text>
            <Button variant="subtle" color="red" size="xs" onClick={onClearSamples}>
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
          {samples.length === 0 ? (
            <Text ta="center" c="dimmed" size="sm" py="md">
              No files selected yet
            </Text>
          ) : (
            <Stack gap={2}>
              {samples.map((sample) => (
                <SelectedSampleRow
                  key={sample.id}
                  sample={sample}
                  onRemove={() => onRemoveSample(sample.id)}
                />
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Flex>
    </>
  )
})

export const CreateTaskButton: FC<CreateTaskButtonProps> = ({ project, create }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDropProcessing, setIsDropProcessing] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [samples, setSamples] = useState<INewSample[]>([])
  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const openModal = useCallback(() => {
    setTaskName(``)
    setIsModalOpen(true)
  }, [])

  const openImportModal = useCallback(() => setIsImportOpen(true), [])
  const clearSamples = useCallback(() => setSamples([]), [])
  const removeSample = useCallback((id: string) => {
    setSamples((s) => s.filter((sample) => sample.id !== id))
  }, [])

  return (
    <>
      <Dropzone.FullScreen
        active={!isModalOpen}
        loading={isDropProcessing}
        accept={IMAGE_MIME_TYPE}
        onDrop={(files) => {
          setIsDropProcessing(true)
          toast
            .promise(filesToSamples(files), {
              loading: `Processing ${files.length} file${files.length === 1 ? '' : 's'}`,
              success: 'Files added',
              error: (e) => {
                console.error(e)
                return 'Failed to read image files'
              }
            })
            .then((newSamples) => {
              setSamples(newSamples)
              openModal()
            })
            .catch(() => {})
            .finally(() => setIsDropProcessing(false))
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
      <ImportSamplesModal
        opened={isImportOpen}
        project={project}
        onClose={() => setIsImportOpen(false)}
        onImported={async (newSamples) => {
          setSamples((s) => [...s, ...newSamples])
        }}
      />
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
          <SampleList
            samples={samples}
            onAddSamples={openImportModal}
            onRemoveSample={removeSample}
            onClearSamples={clearSamples}
          />
          <Button
            fullWidth
            onClick={() => {
              toast.promise(create(taskName, samples), {
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
          setSamples([])
          openModal()
        }}
      >
        Create Task
      </Button>
    </>
  )
}
