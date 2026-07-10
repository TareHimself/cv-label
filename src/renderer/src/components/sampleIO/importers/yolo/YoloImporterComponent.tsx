import { useRef, useState, type ChangeEvent, type FC } from 'react'
import { Button, Group, Loader, Progress, ScrollArea, Select, Stack, Text } from '@mantine/core'
import type { SegmentedControlItem } from '@mantine/core'
import toast from 'react-hot-toast'
import { FaFileZipper, FaFolderOpen } from 'react-icons/fa6'
import type { SampleImporterComponentProps } from '../../types'
import { LabeledSegmentedControl } from '../../LabeledSegmentedControl'
import { findLabelIdByName } from '../matchLabel'
import {
  virtualFilesFromFileList,
  virtualFilesFromZip,
  type VirtualFile
} from '../virtualFileSystem'
import {
  findReferencedClassIds,
  findYoloClasses,
  findYoloImagePairs,
  yoloDatasetToSamples,
  YoloLabelFormat,
  type YoloClass,
  type YoloImagePair
} from './parseYolo'

const FORMAT_OPTIONS: SegmentedControlItem[] = [
  { value: YoloLabelFormat.Detection, label: 'Detection' },
  { value: YoloLabelFormat.Segmentation, label: 'Segmentation' }
]

type WizardState =
  | { step: 'select-source' }
  | { step: 'parsing' }
  | { step: 'mapping'; classes: YoloClass[]; pairs: YoloImagePair[] }
  | { step: 'importing'; progress: number }

export const YoloImporterComponent: FC<SampleImporterComponentProps> = ({
  project,
  onComplete,
  onCancel
}) => {
  const [state, setState] = useState<WizardState>({ step: 'select-source' })
  const [labelByClassId, setLabelByClassId] = useState<Map<number, string>>(new Map())
  const [format, setFormat] = useState<YoloLabelFormat>(YoloLabelFormat.Detection)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const loadSource = async (getFiles: () => Promise<VirtualFile[]> | VirtualFile[]) => {
    setState({ step: 'parsing' })
    try {
      const files = await getFiles()
      const pairs = findYoloImagePairs(files)
      if (pairs.length === 0) {
        toast.error('No images found - is this a YOLO dataset?')
        setState({ step: 'select-source' })
        return
      }

      let classes = await findYoloClasses(files)
      if (classes === null) {
        const referencedIds = await findReferencedClassIds(pairs)
        classes = referencedIds.map((id) => ({ id, name: `Class ${id}` }))
      }

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
    loadSource(() => virtualFilesFromZip(file))
  }

  const handleFolderSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    e.target.value = ''
    if (!fileList || fileList.length === 0) return
    loadSource(() => virtualFilesFromFileList(fileList))
  }

  const runImport = async () => {
    if (state.step !== 'mapping') return
    setState({ step: 'importing', progress: 0 })
    try {
      const samples = await yoloDatasetToSamples(
        state.pairs,
        labelByClassId,
        format,
        (completed, total) => {
          setState({ step: 'importing', progress: Math.round((completed / total) * 100) })
        }
      )
      onComplete(samples)
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
          Select a YOLO-format dataset - either a zip file or a folder containing images and their
          matching label .txt files.
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
          data-testid="yolo-zip-input"
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
          data-testid="yolo-folder-input"
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
        {classes.length === 1 ? '' : 'es'}. Map each YOLO class to a project label.
      </Text>
      {!hasProjectLabels && (
        <Text size="sm" c="red">
          This project has no labels yet - add one before importing.
        </Text>
      )}
      <LabeledSegmentedControl
        label="Label Format"
        value={format}
        options={FORMAT_OPTIONS}
        onChange={setFormat}
      />
      <ScrollArea style={{ maxHeight: 260 }} type="always" scrollbars="y">
        <Stack gap="sm">
          {classes.map((yoloClass) => (
            <Group key={yoloClass.id} wrap="nowrap">
              <Text size="sm" flex={1} truncate>
                {yoloClass.name}
              </Text>
              <Select
                flex={1}
                data={project.labels.map((label) => ({ value: label.id, label: label.name }))}
                value={labelByClassId.get(yoloClass.id) ?? null}
                onChange={(value) => {
                  if (!value) return
                  setLabelByClassId((current) => new Map(current).set(yoloClass.id, value))
                }}
                // This importer lives inside ImportSamplesModal, which raises its own
                // zIndex to 1000 to stack above other modals - without matching that here,
                // this dropdown renders behind the modal body and can't be clicked.
                comboboxProps={{ zIndex: 1001 }}
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
