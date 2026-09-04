import { useRef, useState, type ChangeEvent } from 'react'
import { Button, Group, Progress, Stack, Text } from '@mantine/core'
import { Dropzone, IMAGE_MIME_TYPE, type FileWithPath } from '@mantine/dropzone'
import { FaRegImages } from 'react-icons/fa'
import { FaFolderOpen } from 'react-icons/fa6'
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
  const folderInputRef = useRef<HTMLInputElement>(null)

  const runImport = async (files: File[], nameHint: string | undefined) => {
    setIsImporting(true)
    setProgress(0)
    try {
      const scratchDir = await window.system.createTemporaryDirectory()
      const samples = await filesToSamples(files, scratchDir, (completed, total) =>
        setProgress(Math.round((completed / total) * 100))
      )
      onComplete([{ name: nameHint, samples }], scratchDir)
    } catch (error) {
      console.error(error)
      toast.error('Failed to read image files')
    } finally {
      setIsImporting(false)
    }
  }

  const handleDrop = (files: FileWithPath[]) => {
    runImport(files, folderNameFromDroppedFiles(files) ?? undefined)
  }

  const handleFolderSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) {
      e.target.value = ''
      return
    }
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    const folderName = fileList[0].webkitRelativePath.split('/')[0] || undefined
    e.target.value = ''
    runImport(files, folderName)
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
      <Group justify="center">
        <Button
          variant="outline"
          leftSection={<FaFolderOpen />}
          onClick={() => folderInputRef.current?.click()}
          disabled={isImporting}
        >
          Choose Folder
        </Button>
      </Group>
      <input
        ref={folderInputRef}
        type="file"
        // Non-standard but universally supported in Chromium/Electron for folder picking.
        // @ts-expect-error not in the HTML input attribute typings
        webkitdirectory=""
        multiple
        data-testid="plain-images-folder-input"
        style={{ display: 'none' }}
        onChange={handleFolderSelected}
      />
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
