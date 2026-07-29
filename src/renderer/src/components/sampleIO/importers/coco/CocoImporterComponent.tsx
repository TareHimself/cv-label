import { useRef, useState, type ChangeEvent, type FC } from 'react'
import { Button, Group, Loader, Progress, ScrollArea, Select, Stack, Text } from '@mantine/core'
import toast from 'react-hot-toast'
import { FaFileZipper, FaFolderOpen } from 'react-icons/fa6'
import type { SampleImporterComponentProps } from '../../types'
import { ZIndex } from '@renderer/zIndex'
import { findLabelIdByName } from '../matchLabel'
import {
  virtualFilesFromExtractedZip,
  virtualFilesFromFileList,
  type VirtualFile
} from '../virtualFileSystem'
import {
  cocoDatasetToSamples,
  findCocoClasses,
  findCocoImagePairs,
  type CocoClass,
  type CocoImagePair
} from './parseCoco'

type WizardState =
  | { step: 'select-source' }
  | { step: 'parsing' }
  | { step: 'mapping'; classes: CocoClass[]; pairs: CocoImagePair[] }
  | { step: 'importing'; progress: number }

export const CocoImporterComponent: FC<SampleImporterComponentProps> = ({
  project,
  onComplete,
  onCancel
}) => {
  const [state, setState] = useState<WizardState>({ step: 'select-source' })
  const [labelByClassId, setLabelByClassId] = useState<Map<number, string>>(new Map())
  const zipInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const scratchDirRef = useRef<string | null>(null)

  const ensureScratchDir = async (): Promise<string> => {
    if (!scratchDirRef.current) {
      scratchDirRef.current = await window.system.createTemporaryDirectory()
    }
    return scratchDirRef.current
  }

  const loadSource = async (
    getFiles: (scratchDir: string) => Promise<VirtualFile[]> | VirtualFile[]
  ) => {
    setState({ step: 'parsing' })
    try {
      const scratchDir = await ensureScratchDir()
      const files = await getFiles(scratchDir)
      const pairs = await findCocoImagePairs(files)
      if (pairs.length === 0) {
        toast.error('No images found - is this a COCO dataset?')
        setState({ step: 'select-source' })
        return
      }

      const classes = await findCocoClasses(files)
      setLabelByClassId(
        new Map(
          classes.map((c) => [
            c.id,
            findLabelIdByName(project.labels, c.name) ?? project.labels[0]?.id
          ]) as [number, string | undefined][]
        ) as Map<number, string>
      )
      setState({ step: 'mapping', classes, pairs })
    } catch (error) {
      console.error(error)
      toast.error('Failed to read the dataset')
      setState({ step: 'select-source' })
    }
  }

  const handleZipSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    loadSource((scratchDir) => virtualFilesFromExtractedZip(file, scratchDir))
  }

  const handleFolderSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) {
      e.target.value = ''
      return
    }
    // input.files is the same mutable FileList object on every read, not a fresh
    // snapshot - materialize it into a plain array before resetting the input's value
    // below (needed so re-picking the same folder still fires onChange), since that reset
    // clears this same FileList in place.
    const files = Array.from(fileList)
    e.target.value = ''
    loadSource(() => virtualFilesFromFileList(files))
  }

  const runImport = async () => {
    if (state.step !== 'mapping') return
    const scratchDir = await ensureScratchDir()
    setState({ step: 'importing', progress: 0 })
    try {
      const samples = await cocoDatasetToSamples(
        state.pairs,
        labelByClassId,
        scratchDir,
        (completed, total) => {
          setState({ step: 'importing', progress: Math.round((completed / total) * 100) })
        }
      )
      onComplete(samples, scratchDir)
    } catch (error) {
      console.error(error)
      toast.error('Failed to import the dataset')
      setState({ step: 'mapping', classes: state.classes, pairs: state.pairs })
    }
  }

  if (state.step === 'select-source' || state.step === 'parsing') {
    return (
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Select a COCO-format dataset - either a zip file or a folder containing images and a
          matching <code>_annotations.coco.json</code>.
        </Text>
        {state.step === 'parsing' ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Reading dataset…
            </Text>
          </Group>
        ) : (
          <Group grow>
            <Button leftSection={<FaFileZipper />} onClick={() => zipInputRef.current?.click()}>
              Choose Zip File
            </Button>
            <Button
              variant="outline"
              leftSection={<FaFolderOpen />}
              onClick={() => folderInputRef.current?.click()}
            >
              Choose Folder
            </Button>
          </Group>
        )}
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          data-testid="coco-zip-input"
          style={{ display: 'none' }}
          onChange={handleZipSelected}
        />
        <input
          ref={folderInputRef}
          type="file"
          // Non-standard but universally supported in Chromium/Electron for folder picking.
          // @ts-expect-error not in the HTML input attribute typings
          webkitdirectory=""
          multiple
          data-testid="coco-folder-input"
          style={{ display: 'none' }}
          onChange={handleFolderSelected}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
        </Group>
      </Stack>
    )
  }

  if (state.step === 'importing') {
    return (
      <Stack gap="lg">
        <Progress value={state.progress} animated />
        <Text size="xs" c="dimmed" ta="center">
          Importing samples… {state.progress}%
        </Text>
      </Stack>
    )
  }

  const { classes, pairs } = state
  const hasProjectLabels = project.labels.length > 0

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Found {pairs.length} image{pairs.length === 1 ? '' : 's'} and {classes.length} class
        {classes.length === 1 ? '' : 'es'}. Map each COCO category to a project label.
      </Text>
      {!hasProjectLabels && (
        <Text size="sm" c="red">
          This project has no labels yet - add one before importing.
        </Text>
      )}
      <ScrollArea style={{ maxHeight: 260 }} type="always" scrollbars="y">
        <Stack gap="sm">
          {classes.map((cocoClass) => (
            <Group key={cocoClass.id} wrap="nowrap">
              <Text size="sm" flex={1} truncate>
                {cocoClass.name}
              </Text>
              <Select
                flex={1}
                data={project.labels.map((label) => ({ value: label.id, label: label.name }))}
                value={labelByClassId.get(cocoClass.id) ?? null}
                onChange={(value) => {
                  if (!value) return
                  setLabelByClassId((current) => new Map(current).set(cocoClass.id, value))
                }}
                // This importer lives inside ImportSamplesModal - without an explicit
                // zIndex above the modal's own, this dropdown renders behind the modal
                // body and can't be clicked.
                comboboxProps={{ zIndex: ZIndex.actionModalContent }}
                disabled={!hasProjectLabels}
                allowDeselect={false}
              />
            </Group>
          ))}
        </Stack>
      </ScrollArea>
      <Group justify="flex-end">
        <Button variant="outline" onClick={() => setState({ step: 'select-source' })}>
          Back
        </Button>
        <Button
          onClick={runImport}
          disabled={!hasProjectLabels || classes.some((c) => !labelByClassId.get(c.id))}
        >
          Import
        </Button>
      </Group>
    </Stack>
  )
}
