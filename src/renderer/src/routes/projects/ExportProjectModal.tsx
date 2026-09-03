import { useEffect, useState, type FC } from 'react'
import { Button, Group, Loader, Modal, Progress, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import type { ArchiveManifest, IProject } from '@shared/types'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { ZIndex } from '@renderer/zIndex'
import { imageExtensionFromUri } from '@renderer/components/sampleIO/exporters/imageExtensionFromUri'
import {
  buildCvLabelManifest,
  cvLabelImagePath,
  type CvLabelManifestSample,
  type CvLabelManifestTask
} from '@renderer/components/sampleIO/exporters/cvLabelJson/buildCvLabel'

type ExportPhase = 'preparing' | 'exporting'

export type ExportProjectModalProps = {
  opened: boolean
  project: IProject | null
  onClose: () => void
}

export const ExportProjectModal: FC<ExportProjectModalProps> = ({ opened, project, onClose }) => {
  const store = useAppStore((s) => s.store)
  const [isExporting, setIsExporting] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>('preparing')
  const [progress, setProgress] = useState(0)

  // Only subscribes while open - unlike CvLabelJsonExporterComponent, this modal stays mounted between opens.
  useEffect(() => {
    if (!opened) return undefined
    return window.exportApi.onProgress(({ completed, total }) => {
      setProgress(Math.round((completed / Math.max(total, 1)) * 100))
    })
  }, [opened])

  if (project === null) return null

  const runExport = async () => {
    setPhase('preparing')
    setProgress(0)
    try {
      const tasks = await store.getTasksForProject(project.id)
      const samplesByTask = await Promise.all(tasks.map((task) => store.getSamplesForTask(task.id)))

      const manifest: ArchiveManifest = { textEntries: [], imageEntries: [] }
      const manifestTasks: CvLabelManifestTask[] = tasks.map((task, i) => ({
        id: task.id,
        name: task.name,
        samples: samplesByTask[i].map((sample): CvLabelManifestSample => {
          const extension = imageExtensionFromUri(sample.imageUri)
          const imageFile = cvLabelImagePath(sample.id, extension)
          manifest.imageEntries.push({ path: imageFile, imageUri: sample.imageUri })
          return {
            id: sample.id,
            name: sample.name,
            split: sample.split,
            annotations: sample.annotations,
            createdAt: sample.createdAt,
            width: sample.width,
            height: sample.height,
            imageFile
          }
        })
      }))

      manifest.textEntries.push({
        path: 'manifest.json',
        content: buildCvLabelManifest(project.labels, manifestTasks)
      })

      setPhase('exporting')
      const saved = await window.exportApi.runExport(`${project.name}.cvlabel`, manifest)
      if (saved) onClose()
    } catch (error) {
      console.error(error)
      toast.error('Failed to export the project')
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Export Project"
      centered
      closeOnClickOutside={false}
      zIndex={ZIndex.actionModal}
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Exports the whole of <strong>{project.name}</strong> - every task and sample - as a single{' '}
          <code>.cvlabel</code> file, for backup or duplication. Re-importing always creates a new
          project.
        </Text>
        {isExporting && (
          <Stack gap={4}>
            {phase === 'preparing' ? (
              <Group justify="center" py="xs">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  Preparing export…
                </Text>
              </Group>
            ) : (
              <>
                <Progress value={progress} animated />
                <Text size="xs" c="dimmed" ta="center">
                  {progress === 0
                    ? 'Waiting for save location…'
                    : `Exporting samples… ${progress}%`}
                </Text>
              </>
            )}
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <AsyncButton
            leftSection={<FaFileExport />}
            onClick={runExport}
            onPendingChange={setIsExporting}
          >
            Export
          </AsyncButton>
        </Group>
      </Stack>
    </Modal>
  )
}
