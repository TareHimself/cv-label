import { useEffect, useState } from 'react'
import { Button, Group, Loader, Progress, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { AsyncButton } from '@renderer/components/AsyncButton'
import type { ArchiveManifest } from '@shared/types'
import type { SampleExporterComponentProps } from '../../types'
import { imageExtensionFromUri } from '../imageExtensionFromUri'
import { exportBaseName } from '../exportBaseName'
import { LabelMapper } from '../../LabelMapper'
import { buildIncludedLabelsAndIndex } from '../labelRouting'
import { buildCvLabelManifest, cvLabelImagePath, type CvLabelManifestSample } from './buildCvLabel'

// 'preparing' covers fetching samples/building the manifest/the save dialog - no progress events arrive during any of that, so without it the bar would sit at 0% unexplained.
type ExportPhase = 'preparing' | 'exporting'

export const CvLabelJsonExporterComponent = ({
  project,
  tasks,
  getSamplesForTask,
  onComplete,
  onCancel
}: SampleExporterComponentProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>('preparing')
  const [progress, setProgress] = useState(0)
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
      const { includedLabels } = buildIncludedLabelsAndIndex(project.labels, mapping)

      const samplesByTask = await Promise.all(tasks.map((task) => getSamplesForTask(task.id)))
      const samples = samplesByTask.flat()

      const manifest: ArchiveManifest = { textEntries: [], imageEntries: [] }
      const manifestSamples: CvLabelManifestSample[] = []

      for (const sample of samples) {
        const extension = imageExtensionFromUri(sample.imageUri)
        const imageFile = cvLabelImagePath(sample.id, extension)

        manifest.imageEntries.push({ path: imageFile, imageUri: sample.imageUri })

        manifestSamples.push({
          id: sample.id,
          name: sample.name,
          split: sample.split,
          annotations: sample.annotations.flatMap((annotation) => {
            const target = mapping.get(annotation.labelId)
            return target ? [{ ...annotation, labelId: target }] : []
          }),
          createdAt: sample.createdAt,
          width: sample.width,
          height: sample.height,
          imageFile
        })
      }

      manifest.textEntries.push({
        path: 'manifest.json',
        content: buildCvLabelManifest({
          kind: 'tasks',
          labels: includedLabels,
          samples: manifestSamples
        })
      })

      setPhase('exporting')
      const saved = await window.exportApi.runExport(
        `${exportBaseName(project, tasks)}.cvlabel`,
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
        Exports {tasks.length} task{tasks.length === 1 ? '' : 's'} as a single <code>.cvlabel</code>{' '}
        file - a flat list of samples and their labels, independent of task structure. Re-importing
        works into any project via a label-mapping step.
      </Text>
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
