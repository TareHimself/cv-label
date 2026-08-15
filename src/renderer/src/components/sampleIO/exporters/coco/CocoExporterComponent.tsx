import { useEffect, useState } from 'react'
import { Button, Group, Loader, Progress, SegmentedControlItem, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { AsyncButton } from '@renderer/components/AsyncButton'
import type { ArchiveManifest, ISample } from '@shared/types'
import type { SampleExporterComponentProps } from '../../types'
import { imageExtensionFromUri } from '../imageExtensionFromUri'
import { exportBaseName } from '../exportBaseName'
import { LabeledSegmentedControl } from '../../LabeledSegmentedControl'
import { LabelMapper } from '../../LabelMapper'
import { buildIncludedLabelsAndIndex } from '../labelRouting'
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

// 'preparing' covers fetching samples and building the manifest, plus the native save
// dialog (no progress events arrive during either) - without it the progress bar would
// otherwise sit at 0% with nothing explaining why until the first image is archived.
type ExportPhase = 'preparing' | 'exporting'

export const CocoExporterComponent = ({
  project,
  tasks,
  getSamplesForTask,
  onComplete,
  onCancel
}: SampleExporterComponentProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>('preparing')
  const [progress, setProgress] = useState(0)
  const [shape, setShape] = useState<CocoShapeMode>(CocoShapeMode.Native)
  const [mapping, setMapping] = useState<Map<string, string | null>>(
    new Map(project.labels.map((label) => [label.id, label.id]))
  )

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
      const { includedLabels, labelIdToIndex } = buildIncludedLabelsAndIndex(
        project.labels,
        mapping
      )
      const categories = buildCocoCategories(includedLabels)
      const labelIdToCategoryId = new Map(
        [...labelIdToIndex].map(([labelId, index]) => [labelId, index + 1])
      )

      const samplesByTask = await Promise.all(tasks.map((task) => getSamplesForTask(task.id)))
      const samples = samplesByTask.flat()
      const samplesBySplit = new Map<string, ISample[]>()
      for (const sample of samples) {
        const bucket = samplesBySplit.get(sample.split) ?? []
        bucket.push(sample)
        samplesBySplit.set(sample.split, bucket)
      }

      const manifest: ArchiveManifest = { textEntries: [], imageEntries: [] }

      for (const [split, splitSamples] of samplesBySplit) {
        const images: CocoImage[] = []
        const annotations: CocoAnnotation[] = []
        let nextImageId = 1
        let nextAnnotationId = 1

        for (const sample of splitSamples) {
          const imageId = nextImageId++
          const extension = imageExtensionFromUri(sample.imageUri)

          manifest.imageEntries.push({
            path: cocoImagePath(sample.id, split, extension),
            imageUri: sample.imageUri
          })
          images.push({
            id: imageId,
            file_name: `${sample.id}.${extension}`,
            width: sample.width,
            height: sample.height
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
        }

        manifest.textEntries.push({
          path: cocoAnnotationsFilePath(split),
          content: JSON.stringify({ images, annotations, categories }, null, 2)
        })
      }

      setPhase('exporting')
      const saved = await window.exportApi.runExport(
        `${exportBaseName(project, tasks)}-coco-export.zip`,
        manifest
      )

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
        Exports {tasks.length} task{tasks.length === 1 ? '' : 's'} as a COCO-format zip, split into
        train/valid/test folders, each with its own images and <code>_annotations.coco.json</code>.
        Every annotation always gets a bbox; choose whether its segmentation is forced to boxes,
        forced to polygons, or left as-is (a plain Box has none, a Polygon keeps its real outline).
      </Text>
      <LabeledSegmentedControl
        label="Shape"
        value={shape}
        options={COCO_SHAPE_OPTIONS}
        onChange={setShape}
        disabled={isExporting}
      />
      <LabelMapper
        items={project.labels}
        options={project.labels}
        mapping={mapping}
        onChange={(id, value) => setMapping((current) => new Map(current).set(id, value))}
        excludeLabel="Don't Export"
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
