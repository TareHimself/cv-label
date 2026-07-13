import { useState } from 'react'
import { Button, Group, Progress, SegmentedControlItem, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import type { ISample } from '@shared/types'
import type { SampleExporterComponentProps } from '../../types'
import { imageExtensionFromUri } from '../imageExtensionFromUri'
import { LabeledSegmentedControl } from '../../LabeledSegmentedControl'
import {
  buildCocoAnnotations,
  buildCocoCategories,
  CocoAnnotation,
  CocoImage,
  cocoAnnotationsFilePath,
  cocoImagePath,
  CocoShapeMode
} from './buildCoco'

const COCO_SHAPE_OPTIONS: SegmentedControlItem[] = [
  { value: CocoShapeMode.Box, label: 'Bounding Boxes' },
  { value: CocoShapeMode.Segment, label: 'Segments' },
  { value: CocoShapeMode.Native, label: 'As Is' }
]

export const CocoExporterComponent = ({
  project,
  tasks,
  getSamplesForTask,
  onComplete,
  onCancel
}: SampleExporterComponentProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [shape, setShape] = useState<CocoShapeMode>(CocoShapeMode.Native)

  const runExport = async () => {
    setIsExporting(true)
    try {
      const zip = new JSZip()
      const labelIdToCategoryId = new Map(project.labels.map((label, i) => [label.id, i + 1]))
      const categories = buildCocoCategories(project.labels)

      const samplesByTask = await Promise.all(tasks.map((task) => getSamplesForTask(task.id)))
      const samples = samplesByTask.flat()
      const samplesBySplit = new Map<string, ISample[]>()
      for (const sample of samples) {
        const bucket = samplesBySplit.get(sample.split) ?? []
        bucket.push(sample)
        samplesBySplit.set(sample.split, bucket)
      }

      let completed = 0
      for (const [split, splitSamples] of samplesBySplit) {
        const images: CocoImage[] = []
        const annotations: CocoAnnotation[] = []
        let nextImageId = 1
        let nextAnnotationId = 1

        for (const sample of splitSamples) {
          const response = await fetch(sample.imageUri)
          const blob = await response.blob()
          const bitmap = await createImageBitmap(blob)
          const imageId = nextImageId++
          const extension = imageExtensionFromUri(sample.imageUri)

          zip.file(cocoImagePath(sample.id, split, extension), blob)
          images.push({
            id: imageId,
            file_name: `${sample.id}.${extension}`,
            width: bitmap.width,
            height: bitmap.height
          })
          annotations.push(
            ...buildCocoAnnotations(
              sample.annotations,
              imageId,
              labelIdToCategoryId,
              () => nextAnnotationId++,
              shape
            )
          )

          bitmap.close()
          completed += 1
          setProgress(Math.round((completed / Math.max(samples.length, 1)) * 100))
        }

        zip.file(
          cocoAnnotationsFilePath(split),
          JSON.stringify({ images, annotations, categories }, null, 2)
        )
      }

      const zipData = await zip.generateAsync({ type: 'arraybuffer' })
      const saved = await window.system.saveFile(`${project.name}-coco-export.zip`, zipData)

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
        Exports {tasks.length} task{tasks.length === 1 ? '' : 's'} as a COCO-format zip, split into
        train/valid/test folders, each with its own images and <code>_annotations.coco.json</code>.
        Every annotation always gets a bbox; choose whether its segmentation is forced to boxes,
        forced to polygons, or left as-is (a plain Box has none, a Mask keeps its real outline).
      </Text>
      <LabeledSegmentedControl
        label="Shape"
        value={shape}
        options={COCO_SHAPE_OPTIONS}
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
