import { useState } from 'react'
import { Modal, Stack, UnstyledButton, Text, ThemeIcon } from '@mantine/core'
import { styled } from '@linaria/react'
import type { IProject, ITask } from '@shared/types'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { exporters } from './exporters/registry'
import type { SampleExporter } from './types'

const exporterList = Object.values(exporters)

const ExporterOption = styled(UnstyledButton)`
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

export type ExportSamplesModalProps = {
  opened: boolean
  project: IProject
  tasks: ITask[]
  onClose: () => void
}

export const ExportSamplesModal = ({
  opened,
  project,
  tasks,
  onClose
}: ExportSamplesModalProps) => {
  const store = useAppStore((s) => s.store)
  const [selectedExporter, setSelectedExporter] = useState<SampleExporter | null>(null)
  const [wasOpened, setWasOpened] = useState(opened)

  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) {
      setSelectedExporter(null)
    }
  }

  const title = selectedExporter
    ? `Export Samples: ${selectedExporter.name}`
    : 'Export Samples: Select Format'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      closeOnClickOutside={false}
      zIndex={1000}
    >
      {selectedExporter ? (
        <selectedExporter.Component
          project={project}
          tasks={tasks}
          getSamplesForTask={(taskId) => store.getSamplesForTask(taskId)}
          onComplete={onClose}
          onCancel={() => setSelectedExporter(null)}
        />
      ) : (
        <Stack gap="sm">
          {exporterList.map((exporter) => (
            <ExporterOption key={exporter.id} onClick={() => setSelectedExporter(exporter)}>
              <ThemeIcon variant="light" size="lg" radius="md" mr="md">
                {exporter.icon}
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={600}>{exporter.name}</Text>
                <Text size="xs" c="dimmed">
                  {exporter.description}
                </Text>
              </Stack>
            </ExporterOption>
          ))}
        </Stack>
      )}
    </Modal>
  )
}
