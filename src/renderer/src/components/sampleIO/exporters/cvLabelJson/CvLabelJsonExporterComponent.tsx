import { useState } from 'react'
import { Button, Group, Progress, Stack, Text } from '@mantine/core'
import { FaFileExport } from 'react-icons/fa'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import type { ISample } from '@shared/types'
import type { SampleExporterComponentProps } from '../../types'

interface ManifestSample extends Omit<ISample, 'imageUri'> {
  imageFile: string
}

const imageExtensionFromUri = (imageUri: string) => {
  const idx = imageUri.lastIndexOf('.')
  return idx === -1 ? 'bin' : imageUri.slice(idx + 1)
}

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
    setIsExporting(true)
    try {
      const zip = new JSZip()
      const manifestTasks: { id: string; name: string; samples: ManifestSample[] }[] = []

      let completedSamples = 0
      let totalSamples = 0
      const samplesByTask = await Promise.all(
        tasks.map(async (task) => {
          const samples = await getSamplesForTask(task.id)
          totalSamples += samples.length
          return { task, samples }
        })
      )

      for (const { task, samples } of samplesByTask) {
        const manifestSamples: ManifestSample[] = []

        for (const sample of samples) {
          const { imageUri, ...sampleWithoutUri } = sample
          const extension = imageExtensionFromUri(imageUri)
          const imageFile = `images/${task.id}/${sample.id}.${extension}`

          const response = await fetch(imageUri)
          const blob = await response.blob()
          zip.file(imageFile, blob)

          manifestSamples.push({ ...sampleWithoutUri, imageFile })

          completedSamples += 1
          setProgress(Math.round((completedSamples / Math.max(totalSamples, 1)) * 100))
        }

        manifestTasks.push({ id: task.id, name: task.name, samples: manifestSamples })
      }

      zip.file(
        'manifest.json',
        JSON.stringify(
          {
            project: { id: project.id, name: project.name, labels: project.labels },
            tasks: manifestTasks
          },
          null,
          2
        )
      )

      const zipData = await zip.generateAsync({ type: 'arraybuffer' })
      const saved = await window.system.saveFile(`${project.name}-export.zip`, zipData)

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
        Exports {tasks.length} task{tasks.length === 1 ? '' : 's'} as a zip containing a{' '}
        <code>manifest.json</code> and the sample images.
      </Text>
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
