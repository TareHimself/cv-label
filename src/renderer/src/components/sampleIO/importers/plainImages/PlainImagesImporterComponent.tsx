import { useState } from 'react'
import { Button, Group, Progress, Stack, Text } from '@mantine/core'
import { Dropzone, IMAGE_MIME_TYPE, type FileWithPath } from '@mantine/dropzone'
import { FaRegImages } from 'react-icons/fa'
import toast from 'react-hot-toast'
import type { SampleImporterComponentProps } from '../../types'
import { folderNameFromDroppedFiles } from '@renderer/utils'
import { filesToSamples } from '../filesToSamples'

export const PlainImagesImporterComponent = ({
  onComplete,
  onCancel
}: SampleImporterComponentProps) => {
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDrop = async (files: FileWithPath[]) => {
    setIsImporting(true)
    setProgress(0)
    try {
      const scratchDir = await window.system.createTemporaryDirectory()
      const samples = await filesToSamples(files, scratchDir, (completed, total) =>
        setProgress(Math.round((completed / total) * 100))
      )
      onComplete([{ name: folderNameFromDroppedFiles(files) ?? undefined, samples }], scratchDir)
    } catch (error) {
      console.error(error)
      toast.error('Failed to read image files')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Stack gap="lg">
      <Dropzone
        accept={IMAGE_MIME_TYPE}
        loading={isImporting}
        onDrop={(files) => {
          handleDrop(files)
        }}
      >
        <Group justify="center" gap="xl" mih={160} style={{ pointerEvents: 'none' }}>
          <Stack align="center" gap={4}>
            <FaRegImages size={28} opacity={0.6} />
            <Text size="sm" c="dimmed">
              Drop image files here, or click to browse
            </Text>
          </Stack>
        </Group>
      </Dropzone>
      {isImporting && (
        <Stack gap={4}>
          <Progress value={progress} animated />
          <Text size="xs" c="dimmed" ta="center">
            Processing images… {progress}%
          </Text>
        </Stack>
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
      </Group>
    </Stack>
  )
}
