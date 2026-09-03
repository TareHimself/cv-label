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
import { Dropzone, IMAGE_MIME_TYPE, MIME_TYPES, type FileWithPath } from '@mantine/dropzone'
import { FC, memo, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IoMdAdd } from 'react-icons/io'
import { MdDeleteOutline } from 'react-icons/md'
import { INewSample, IProject } from '@shared/types'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { ImportSamplesModal } from '@renderer/components/sampleIO/ImportSamplesModal'
import type { ImportedTaskGroup } from '@renderer/components/sampleIO/types'
import { CvLabelImporterComponent } from '@renderer/components/sampleIO/importers/cvlabel/CvLabelImporterComponent'
import { filesToSamples } from '@renderer/components/sampleIO/importers/filesToSamples'
import { folderNameFromDroppedFiles, groupFilesByTopFolder } from '@renderer/utils'
import { ZIndex } from '@renderer/zIndex'

const CVLABEL_EXTENSION = /\.cvlabel$/i

// Dropzone needs the record form of `accept` - .cvlabel has no real mime type, so it's keyed under the generic zip mime, same as CvLabelImporterComponent's own Dropzone.
const DROP_ACCEPT: Record<string, string[]> = {
  ...Object.fromEntries(IMAGE_MIME_TYPE.map((mimeType) => [mimeType, []])),
  [MIME_TYPES.zip]: ['.cvlabel']
}

export type CreateTaskButtonProps = {
  project: IProject
  create: (name: string, samples: INewSample[]) => Promise<void>
}

type ImportQueueItem =
  { name: string; files: FileWithPath[] } | { name: string; samples: INewSample[] }

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
  const [sizeBytes, setSizeBytes] = useState<number | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.system.getFileSize(sample.imagePath).then((size) => {
      if (!cancelled) setSizeBytes(size)
    })
    window.system.getScratchPreviewUri(sample.imagePath).then((uri) => {
      if (!cancelled) setPreviewUri(uri)
    })
    return () => {
      cancelled = true
    }
  }, [sample.imagePath])

  return (
    <FileRow>
      <Image src={previewUri ?? undefined} w={36} h={36} radius="sm" fit="cover" />
      <Flex direction="column" flex={1} miw={0} mx="sm">
        <Text size="sm" truncate>
          {sample.name}
        </Text>
        <Text size="xs" c="dimmed">
          {sizeBytes === null ? ' ' : formatFileSize(sizeBytes)}
        </Text>
      </Flex>
      <ActionIcon aria-label="Remove file" variant="subtle" color="red" onClick={onRemove}>
        <MdDeleteOutline size={16} />
      </ActionIcon>
    </FileRow>
  )
})

/** Memoized so typing in the task name field doesn't re-render every imported sample's row - was visibly laggy for a large import otherwise. */
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
  // True when the picker was opened via "Create Task" itself (samples/name get applied, or the queue starts); false when opened via the already-open modal's "Add Samples" (just appends).
  const [isStandaloneImport, setIsStandaloneImport] = useState(false)
  const [isDropProcessing, setIsDropProcessing] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [samples, setSamples] = useState<INewSample[]>([])

  // Holds both the raw files (for the "one task" decline path) and the per-folder grouping (for "separate tasks") when a drop spans multiple folders.
  const [pendingSplit, setPendingSplit] = useState<{
    allFiles: FileWithPath[]
    groups: ImportQueueItem[]
  } | null>(null)

  // A dropped .cvlabel needs a label-mapping step, so it opens the same importer wizard "Add Samples" uses instead of going straight into startQueue.
  const [cvLabelDropFile, setCvLabelDropFile] = useState<FileWithPath | null>(null)

  // Drives the Create Task modal through one queued item at a time - Skip/Create both advance; the close button abandons the whole queue instead.
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([])
  const [importQueueIndex, setImportQueueIndex] = useState(0)
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)

  // Every scratch dir created this Create Task session - swept once the session ends, however it ends.
  const [, setPendingScratchDirs] = useState<string[]>([])

  const discardPendingScratchDirs = useCallback(() => {
    setPendingScratchDirs((dirs) => {
      for (const dir of dirs) {
        window.system.deleteDirectory(dir).catch(() => {})
      }
      return []
    })
  }, [])

  const openModal = useCallback((name: string = '') => {
    setTaskName(name)
    setIsModalOpen(true)
  }, [])

  const loadQueueItem = useCallback(
    (queue: ImportQueueItem[], index: number) => {
      const item = queue[index]
      if ('samples' in item) {
        setSamples(item.samples)
        openModal(item.name)
        return
      }

      const { name, files } = item
      setIsDropProcessing(true)
      toast
        .promise(
          window.system.createTemporaryDirectory().then(async (scratchDir) => ({
            scratchDir,
            newSamples: await filesToSamples(files, scratchDir)
          })),
          {
            loading: `Processing ${files.length} file${files.length === 1 ? '' : 's'}`,
            success: 'Files loaded',
            error: (e) => {
              console.error(e)
              return 'Failed to read image files'
            }
          }
        )
        .then(({ newSamples, scratchDir }) => {
          setSamples(newSamples)
          setPendingScratchDirs((dirs) => [...dirs, scratchDir])
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

  /** Feeds one importer's result into the create-task flow: a single group prefills the modal directly, several start the same one-task-at-a-time queue the folder-split path uses. */
  const applyImportResult = useCallback(
    (taskGroups: ImportedTaskGroup[], scratchDir: string) => {
      setPendingScratchDirs((dirs) => [...dirs, scratchDir])
      if (taskGroups.length <= 1) {
        setSamples(taskGroups[0]?.samples ?? [])
        openModal(taskGroups[0]?.name ?? '')
      } else {
        startQueue(taskGroups.map((g) => ({ name: g.name ?? '', samples: g.samples })))
      }
    },
    [openModal, startQueue]
  )

  // Shared by Skip and Create - both move to the next queued folder, or close once there isn't one.
  const advanceQueue = () => {
    const nextIndex = importQueueIndex + 1
    if (nextIndex < importQueue.length) {
      setImportQueueIndex(nextIndex)
      loadQueueItem(importQueue, nextIndex)
    } else {
      setIsModalOpen(false)
      setImportQueue([])
      setImportQueueIndex(0)
      // Clears immediately (empty name disables Create) rather than leaving a window, during Mantine's close transition, to resubmit and hit a UNIQUE constraint.
      setSamples([])
      setTaskName('')
      discardPendingScratchDirs()
    }
  }

  // Unlike Skip, this abandons every remaining queued folder, not just the current one.
  const stopQueue = () => {
    setIsStopConfirmOpen(false)
    setIsModalOpen(false)
    setImportQueue([])
    setImportQueueIndex(0)
    discardPendingScratchDirs()
  }

  const handleModalClose = () => {
    if (importQueue.length > 1) {
      setIsStopConfirmOpen(true)
    } else {
      setIsModalOpen(false)
      discardPendingScratchDirs()
    }
  }

  const openImportModal = useCallback(() => {
    setIsStandaloneImport(false)
    setIsImportOpen(true)
  }, [])
  const clearSamples = useCallback(() => setSamples([]), [])
  const removeSample = useCallback((id: string) => {
    setSamples((s) => s.filter((sample) => sample.id !== id))
  }, [])

  return (
    <>
      <Dropzone.FullScreen
        active={!isModalOpen && cvLabelDropFile === null}
        loading={isDropProcessing}
        accept={DROP_ACCEPT}
        onDrop={(files) => {
          const cvLabelFile = files.find((f) => CVLABEL_EXTENSION.test(f.name))
          if (cvLabelFile) {
            setCvLabelDropFile(cvLabelFile)
            return
          }

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
            <Text size="sm" c="dimmed" inline mt={4} ta="center">
              or a .cvlabel file
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
      <Modal
        opened={cvLabelDropFile !== null}
        onClose={() => setCvLabelDropFile(null)}
        title="Import .cvlabel"
        centered
        closeOnClickOutside={false}
        zIndex={ZIndex.actionModal}
      >
        {cvLabelDropFile && (
          <CvLabelImporterComponent
            project={project}
            initialFile={cvLabelDropFile}
            onComplete={(taskGroups, scratchDir) => {
              setCvLabelDropFile(null)
              applyImportResult(taskGroups, scratchDir)
            }}
            onCancel={() => setCvLabelDropFile(null)}
          />
        )}
      </Modal>
      <ImportSamplesModal
        opened={isImportOpen}
        project={project}
        onClose={() => setIsImportOpen(false)}
        onImported={async (taskGroups, scratchDir) => {
          if (isStandaloneImport) {
            applyImportResult(taskGroups, scratchDir)
          } else {
            setSamples((s) => [...s, ...taskGroups.flatMap((g) => g.samples)])
            setPendingScratchDirs((dirs) => [...dirs, scratchDir])
          }
        }}
        onSkip={
          isStandaloneImport
            ? () => {
                setIsImportOpen(false)
                openModal('')
              }
            : undefined
        }
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
              <Button variant="outline" onClick={advanceQueue} disabled={isDropProcessing}>
                Skip
              </Button>
            )}
            <AsyncButton
              onClick={async () => {
                const result = create(taskName, samples)
                await toast.promise(result, {
                  loading: 'Creating task',
                  success: 'Task created',
                  error: (e) => {
                    console.error(e)
                    return 'Failed to create task'
                  }
                })
                advanceQueue()
                return result
              }}
              disabled={taskName.trim().length === 0 || isDropProcessing}
            >
              Create
            </AsyncButton>
          </Group>
        </Stack>
      </Modal>
      <Button
        leftSection={<IoMdAdd />}
        onClick={() => {
          setSamples([])
          setImportQueue([])
          setImportQueueIndex(0)
          setIsStandaloneImport(true)
          setIsImportOpen(true)
        }}
      >
        Create Task
      </Button>
    </>
  )
}
