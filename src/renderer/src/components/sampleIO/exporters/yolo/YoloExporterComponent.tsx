import { useEffect, useState } from 'react'
import { Button, Group, Loader, Progress, SegmentedControlItem, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { AsyncButton } from '@renderer/components/AsyncButton'
import type { ArchiveManifest } from '@shared/types'
import type { SampleExporterComponentProps } from '../../types'
import { imageExtensionFromUri } from '../imageExtensionFromUri'
import { ExportShape } from '../annotationShape'
import { LabeledSegmentedControl } from '../../LabeledSegmentedControl'
import { buildYoloDataYaml, yoloImagePath, yoloLabelFileContent, yoloLabelPath } from './buildYolo'

const YOLO_SHAPE_OPTIONS: SegmentedControlItem[] = [
  { value: ExportShape.Box, label: 'Bounding Boxes' },
  { value: ExportShape.Segment, label: 'Segments' }
]

// 'preparing' covers fetching samples and building the manifest, plus the native save
// dialog (no progress events arrive during either) - without it the progress bar would
// otherwise sit at 0% with nothing explaining why until the first image is archived.
type ExportPhase = 'preparing' | 'exporting'

export const YoloExporterComponent = ({
  project,
  tasks,
  getSamplesForTask,
  onComplete,
  onCancel
}: SampleExporterComponentProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>('preparing')
  const [progress, setProgress] = useState(0)
  const [shape, setShape] = useState<ExportShape>(ExportShape.Box)

  useEffect(
    () =>
      window.exportApi.onProgress(({ completed, total }) => {
        setProgress(Math.round((completed / Math.max(total, 1)) * 100))
      }),
    []
  )

  const runExport = async () => {
    setPhase('preparing')
    setProgress(0)
    try {
      const labelIdToClassId = new Map(project.labels.map((label, id) => [label.id, id]))

      const samplesByTask = await Promise.all(tasks.map((task) => getSamplesForTask(task.id)))
      const samples = samplesByTask.flat()

      const manifest: ArchiveManifest = { textEntries: [], imageEntries: [] }

      for (const sample of samples) {
        const extension = imageExtensionFromUri(sample.imageUri)

        manifest.imageEntries.push({
          path: yoloImagePath(sample.id, sample.split, extension),
          imageUri: sample.imageUri
        })
        manifest.textEntries.push({
          path: yoloLabelPath(sample.id, sample.split),
          content: yoloLabelFileContent(
            sample.annotations,
            labelIdToClassId,
            sample.width,
            sample.height,
            shape
          )
        })
      }

      manifest.textEntries.push({ path: 'data.yaml', content: buildYoloDataYaml(project.labels) })

      setPhase('exporting')
      const saved = await window.exportApi.runExport(`${project.name}-yolo-export.zip`, manifest)

      if (saved) {
        onComplete()
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to export samples')
    }
  }

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Exports {tasks.length} task{tasks.length === 1 ? '' : 's'} as a YOLO-format zip (
        <code>data.yaml</code>, <code>images/</code>, <code>labels/</code>), split into
        train/valid/test folders. Every annotation is normalized to the chosen shape.
      </Text>
      <LabeledSegmentedControl
        label="Shape"
        value={shape}
        options={YOLO_SHAPE_OPTIONS}
        onChange={setShape}
        disabled={isExporting}
      />
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
                {progress === 0 ? 'Waiting for save location…' : `Exporting samples… ${progress}%`}
              </Text>
            </>
          )}
        </Stack>
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel} disabled={isExporting}>
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
  )
}
