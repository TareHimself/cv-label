import { useState } from 'react'
import { Button, Group, Progress, SegmentedControlItem, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import type { SampleExporterComponentProps } from '../../types'
import { imageExtensionFromUri } from '../imageExtensionFromUri'
import { ExportShape } from '../annotationShape'
import { LabeledSegmentedControl } from '../../LabeledSegmentedControl'
import { buildYoloDataYaml, yoloImagePath, yoloLabelFileContent, yoloLabelPath } from './buildYolo'

const YOLO_SHAPE_OPTIONS: SegmentedControlItem[] = [
  { value: ExportShape.Box, label: 'Bounding Boxes' },
  { value: ExportShape.Segment, label: 'Segments' }
]

export const YoloExporterComponent = ({
  project,
  tasks,
  getSamplesForTask,
  onComplete,
  onCancel
}: SampleExporterComponentProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [shape, setShape] = useState<ExportShape>(ExportShape.Box)

  const runExport = async () => {
    setIsExporting(true)
    try {
      const zip = new JSZip()
      const labelIdToClassId = new Map(project.labels.map((label, id) => [label.id, id]))

      const samplesByTask = await Promise.all(tasks.map((task) => getSamplesForTask(task.id)))
      const samples = samplesByTask.flat()

      let completed = 0
      for (const sample of samples) {
        const response = await fetch(sample.imageUri)
        const blob = await response.blob()
        const bitmap = await createImageBitmap(blob)

        zip.file(
          yoloImagePath(sample.id, sample.split, imageExtensionFromUri(sample.imageUri)),
          blob
        )
        zip.file(
          yoloLabelPath(sample.id, sample.split),
          yoloLabelFileContent(
            sample.annotations,
            labelIdToClassId,
            bitmap.width,
            bitmap.height,
            shape
          )
        )

        bitmap.close()
        completed += 1
        setProgress(Math.round((completed / Math.max(samples.length, 1)) * 100))
      }

      zip.file('data.yaml', buildYoloDataYaml(project.labels))

      const zipData = await zip.generateAsync({ type: 'arraybuffer' })
      const saved = await window.system.saveFile(`${project.name}-yolo-export.zip`, zipData)

      if (saved) {
        onComplete()
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to export samples')
    } finally {
      setIsExporting(false)
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
      {isExporting && <Progress value={progress} animated />}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel} disabled={isExporting}>
          Cancel
        </Button>
        <Button leftSection={<FaFileExport />} loading={isExporting} onClick={runExport}>
          Export
        </Button>
      </Group>
    </Stack>
  )
}
