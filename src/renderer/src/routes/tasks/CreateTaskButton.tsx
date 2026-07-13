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
import { Dropzone, IMAGE_MIME_TYPE, type FileWithPath } from '@mantine/dropzone'
import { FC, memo, useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { IoMdAdd } from 'react-icons/io'
import { MdDeleteOutline } from 'react-icons/md'
import { INewSample, IProject } from '@shared/types'
import { ImportSamplesModal } from '@renderer/components/sampleIO/ImportSamplesModal'
import { filesToSamples } from '@renderer/components/sampleIO/importers/filesToSamples'
import { folderNameFromDroppedFiles, groupFilesByTopFolder } from '@renderer/utils'
import { ZIndex } from '@renderer/zIndex'

export type CreateTaskButtonProps = {
  project: IProject
  create: (name: string, samples: INewSample[]) => Promise<void>
}

type ImportQueueItem = { name: string; files: FileWithPath[] }

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

  // When a drop spans more than one top-level folder, pendingSplit holds both the raw
  // files (for the "one task" decline path) and the per-folder grouping (for "separate
  // tasks"), while the confirm modal asks which the user wants.
  const [pendingSplit, setPendingSplit] = useState<{
    allFiles: FileWithPath[]
    groups: ImportQueueItem[]
  } | null>(null)

  // Once a choice is made, importQueue drives the Create Task modal through one item at
  // a time - Skip or Create both advance to the next. The close button means something
  // stronger: abandon the rest of the queue entirely, so it's confirmed separately.
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([])
  const [importQueueIndex, setImportQueueIndex] = useState(0)
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)

  const openModal = useCallback((name: string = '') => {
    setTaskName(name)
    setIsModalOpen(true)
  }, [])

  const loadQueueItem = useCallback(
    (queue: ImportQueueItem[], index: number) => {
      const { name, files } = queue[index]
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
          openModal(name)
        })
        .catch(() => {})
        .finally(() => setIsDropProcessing(false))
    },
    [openModal]
  )

  const startQueue = useCallback(
    (queue: ImportQueueItem[]) => {
      setImportQueue(queue)
      setImportQueueIndex(0)
      loadQueueItem(queue, 0)
    },
    [loadQueueItem]
  )

  // Shared by both Skip and Create - either one is "done with this step," so both move
  // on to the next queued folder, or close once there isn't one.
  const advanceQueue = () => {
    const nextIndex = importQueueIndex + 1
    if (nextIndex < importQueue.length) {
      setImportQueueIndex(nextIndex)
      loadQueueItem(importQueue, nextIndex)
    } else {
      setIsModalOpen(false)
      setImportQueue([])
      setImportQueueIndex(0)
    }
  }

  // The close button, once confirmed: unlike Skip, this abandons every remaining queued
  // folder (not just the current one) rather than continuing to the next.
  const stopQueue = () => {
    setIsStopConfirmOpen(false)
    setIsModalOpen(false)
    setImportQueue([])
    setImportQueueIndex(0)
  }

  const handleModalClose = () => {
    if (importQueue.length > 1) {
      setIsStopConfirmOpen(true)
    } else {
      setIsModalOpen(false)
    }
  }

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
          const groups = groupFilesByTopFolder(files)
          if (groups.size > 1) {
            setPendingSplit({
              allFiles: files,
              groups: Array.from(groups, ([name, groupFiles]) => ({ name, files: groupFiles }))
            })
            return
          }
          startQueue([{ name: folderNameFromDroppedFiles(files) ?? '', files }])
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
        opened={pendingSplit !== null}
        onClose={() => setPendingSplit(null)}
        title="Multiple folders detected"
        centered
        zIndex={ZIndex.confirmationModal}
      >
        <Stack gap="lg">
          <Text size="sm">
            You dropped {pendingSplit?.groups.length ?? 0} folders. Create a separate task for each
            one?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="outline"
              onClick={() => {
                const files = pendingSplit?.allFiles ?? []
                setPendingSplit(null)
                startQueue([{ name: folderNameFromDroppedFiles(files) ?? '', files }])
              }}
            >
              No, one task
            </Button>
            <Button
              onClick={() => {
                const groups = pendingSplit?.groups ?? []
                setPendingSplit(null)
                startQueue(groups)
              }}
            >
              Yes, {pendingSplit?.groups.length ?? 0} tasks
            </Button>
          </Group>
        </Stack>
      </Modal>
      <ImportSamplesModal
        opened={isImportOpen}
        project={project}
        onClose={() => setIsImportOpen(false)}
        onImported={async (newSamples) => {
          setSamples((s) => [...s, ...newSamples])
        }}
        zIndex={ZIndex.nestedActionModal}
      />
      <Modal
        opened={isStopConfirmOpen}
        onClose={() => setIsStopConfirmOpen(false)}
        title="Stop creating tasks?"
        centered
        zIndex={ZIndex.confirmationModal}
      >
        <Stack gap="lg">
          <Text size="sm">
            {importQueue.length - importQueueIndex} folder
            {importQueue.length - importQueueIndex === 1 ? '' : 's'} left won&apos;t be imported.
            This won&apos;t affect tasks already created.
          </Text>
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setIsStopConfirmOpen(false)}>
              Keep going
            </Button>
            <Button color="red" onClick={stopQueue}>
              Stop
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={isModalOpen}
        onClose={handleModalClose}
        title={
          importQueue.length > 1
            ? `Create Task (${importQueueIndex + 1}/${importQueue.length})`
            : 'Create Task'
        }
        centered
        closeOnClickOutside={false}
        zIndex={ZIndex.actionModal}
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
          <Group grow>
            {importQueue.length > 1 && (
              <Button variant="outline" onClick={advanceQueue}>
                Skip
              </Button>
            )}
            <Button
              onClick={() => {
                toast.promise(create(taskName, samples), {
                  loading: 'Creating task',
                  success: 'Task created',
                  error: (e) => {
                    console.error(e)
                    return 'Failed to create task'
                  }
                })
                advanceQueue()
              }}
              disabled={taskName.trim().length === 0}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Button
        leftSection={<IoMdAdd />}
        onClick={() => {
          setSamples([])
          setImportQueue([])
          setImportQueueIndex(0)
          openModal()
        }}
      >
        Create Task
      </Button>
    </>
  )
}
