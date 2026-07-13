import { useState } from 'react'
import { Button, Group, Progress, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { AsyncButton } from '@renderer/components/AsyncButton'
import type { SampleExporterComponentProps } from '../../types'
import { imageExtensionFromUri } from '../imageExtensionFromUri'
import { buildCvLabelManifest, cvLabelImagePath, type CvLabelManifestSample } from './buildCvLabel'

export const CvLabelJsonExporterComponent = ({
  project,
  tasks,
  getSamplesForTask,
  onComplete,
  onCancel
}: SampleExporterComponentProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const runExport = async () => {
    try {
      const zip = new JSZip()
      const samplesByTask = await Promise.all(tasks.map((task) => getSamplesForTask(task.id)))
      const samples = samplesByTask.flat()

      const manifestSamples: CvLabelManifestSample[] = []
      let completed = 0
      for (const sample of samples) {
        const extension = imageExtensionFromUri(sample.imageUri)
        const imageFile = cvLabelImagePath(sample.id, extension)

        const response = await fetch(sample.imageUri)
        const blob = await response.blob()
        zip.file(imageFile, blob)

        manifestSamples.push({
          id: sample.id,
          name: sample.name,
          split: sample.split,
          annotations: sample.annotations,
          createdAt: sample.createdAt,
          imageFile
        })

        completed += 1
        setProgress(Math.round((completed / Math.max(samples.length, 1)) * 100))
      }

      zip.file('manifest.json', buildCvLabelManifest(project.labels, manifestSamples))

      const zipData = await zip.generateAsync({ type: 'arraybuffer' })
      const saved = await window.system.saveFile(`${project.name}.cvlabel`, zipData)

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
      {isExporting && <Progress value={progress} animated />}
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
