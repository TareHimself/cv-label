import { useState } from 'react'
import { Modal, Stack, UnstyledButton, Text, ThemeIcon } from '@mantine/core'
import { styled } from '@linaria/react'
import toast from 'react-hot-toast'
import type { IProject } from '@shared/types'
import { MdBlock } from 'react-icons/md'
import { ZIndex } from '@renderer/zIndex'
import { importers } from './importers/registry'
import type { ImportedTaskGroup, SampleImporter } from './types'

const importerList = Object.values(importers)

const ImporterOption = styled(UnstyledButton)`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--mantine-radius-md);
  border: 1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4));

  &:hover {
    background-color: light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-5));
  }
`

export type ImportSamplesModalProps = {
  opened: boolean
  project: IProject
  onClose: () => void
  /** scratchDir is where the imported samples' images live - onImported decides when it's safe to delete it. Most importers report one group; a format with its own task structure may report several. */
  onImported: (taskGroups: ImportedTaskGroup[], scratchDir: string) => Promise<void>
  /** Pass ZIndex.nestedActionModal when opened from within another already-open action modal (e.g. Create Task). */
  zIndex?: number
  /** Adds a "None" option at the top of the format list, for a caller that wants a way to proceed with nothing imported (e.g. Create Task's blank-task path). Omit to not offer it. */
  onSkip?: () => void
}

export const ImportSamplesModal = ({
  opened,
  project,
  onClose,
  onImported,
  zIndex = ZIndex.actionModal,
  onSkip
}: ImportSamplesModalProps) => {
  const [selectedImporter, setSelectedImporter] = useState<SampleImporter | null>(null)
  const [wasOpened, setWasOpened] = useState(opened)

  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) {
      setSelectedImporter(null)
    }
  }

  const handleComplete = async (taskGroups: ImportedTaskGroup[], scratchDir: string) => {
    try {
      await toast.promise(onImported(taskGroups, scratchDir), {
        loading: 'Importing samples',
        success: 'Samples imported',
        error: (e) => {
          console.error(e)
          return 'Failed to import samples'
        }
      })
      onClose()
    } catch {
      // Already surfaced via the toast above - keep the modal open so the user can retry.
    }
  }

  const handleCancel = () => {
    setSelectedImporter(null)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={selectedImporter ? `Import Samples: ${selectedImporter.name}` : 'Import Samples'}
      centered
      closeOnClickOutside={false}
      zIndex={zIndex}
    >
      {selectedImporter ? (
        <selectedImporter.Component
          project={project}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      ) : (
        <Stack gap="sm">
          {onSkip && (
            <ImporterOption onClick={onSkip}>
              <ThemeIcon variant="light" size="lg" radius="md" mr="md">
                <MdBlock size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={600}>None</Text>
                <Text size="xs" c="dimmed">
                  Start with an empty task - add samples yourself afterward.
                </Text>
              </Stack>
            </ImporterOption>
          )}
          {importerList.map((importer) => (
            <ImporterOption key={importer.id} onClick={() => setSelectedImporter(importer)}>
              <ThemeIcon variant="light" size="lg" radius="md" mr="md">
                {importer.icon}
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={600}>{importer.name}</Text>
                <Text size="xs" c="dimmed">
                  {importer.description}
                </Text>
              </Stack>
            </ImporterOption>
          ))}
        </Stack>
      )}
    </Modal>
  )
}
