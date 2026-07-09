import { useState } from 'react'
import { Modal, Stack, UnstyledButton, Text, ThemeIcon } from '@mantine/core'
import { styled } from '@linaria/react'
import toast from 'react-hot-toast'
import type { IProject, INewSample } from '@shared/types'
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
  onImported: (samples: INewSample[]) => Promise<void>
}

export const ImportSamplesModal = ({
  opened,
  project,
  onClose,
  onImported
}: ImportSamplesModalProps) => {
  const [selectedImporter, setSelectedImporter] = useState<SampleImporter | null>(null)
  const [wasOpened, setWasOpened] = useState(opened)

  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) {
      setSelectedImporter(null)
    }
  }

  const handleComplete = (samples: INewSample[]) => {
    toast.promise(onImported(samples), {
      loading: 'Importing samples',
      success: 'Samples imported',
      error: (e) => {
        console.error(e)
        return 'Failed to import samples'
      }
    })
    onClose()
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
      zIndex={1000}
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
