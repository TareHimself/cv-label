import { useState } from 'react'
import { Modal, Stack, UnstyledButton, Text, ThemeIcon } from '@mantine/core'
import { styled } from '@linaria/react'
import toast from 'react-hot-toast'
import type { IProject, INewSample } from '@shared/types'
import { ZIndex } from '@renderer/zIndex'
import { importers } from './importers/registry'
import type { SampleImporter } from './types'

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
  /** scratchDir is where the imported samples' image files live - onImported decides
   *  when it's safe to delete it (immediately once persisted, or later if the caller only
   *  stages samples for review before actually persisting them). */
  onImported: (samples: INewSample[], scratchDir: string) => Promise<void>
  /** Defaults to the standalone action-modal layer - pass ZIndex.nestedActionModal when
   *  this is opened from within another already-open action modal (e.g. Create Task). */
  zIndex?: number
}

export const ImportSamplesModal = ({
  opened,
  project,
  onClose,
  onImported,
  zIndex = ZIndex.actionModal
}: ImportSamplesModalProps) => {
  const [selectedImporter, setSelectedImporter] = useState<SampleImporter | null>(null)
  const [wasOpened, setWasOpened] = useState(opened)

  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) {
      setSelectedImporter(null)
    }
  }

  const handleComplete = async (samples: INewSample[], scratchDir: string) => {
    try {
      await toast.promise(onImported(samples, scratchDir), {
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
