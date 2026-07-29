import { useRef, useState, type ChangeEvent, type FC } from 'react'
import { Button, Group, Loader, Progress, ScrollArea, Select, Stack, Text } from '@mantine/core'
import toast from 'react-hot-toast'
import { FaFileZipper } from 'react-icons/fa6'
import type { SampleImporterComponentProps } from '../../types'
import { ZIndex } from '@renderer/zIndex'
import { findLabelIdById, findLabelIdByName } from '../matchLabel'
import { virtualFilesFromExtractedZip } from '../virtualFileSystem'
import {
  cvLabelDatasetToSamples,
  findCvLabelManifest,
  findCvLabelPairs,
  type CvLabelClass,
  type CvLabelPair
} from './parseCvLabel'

type WizardState =
  | { step: 'select-source' }
  | { step: 'parsing' }
  | { step: 'mapping'; classes: CvLabelClass[]; pairs: CvLabelPair[] }
  | { step: 'importing'; progress: number }

export const CvLabelImporterComponent: FC<SampleImporterComponentProps> = ({
  project,
  onComplete,
  onCancel
}) => {
  const [state, setState] = useState<WizardState>({ step: 'select-source' })
  const [labelByClassId, setLabelByClassId] = useState<Map<string, string>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scratchDirRef = useRef<string | null>(null)

  const ensureScratchDir = async (): Promise<string> => {
    if (!scratchDirRef.current) {
      scratchDirRef.current = await window.system.createTemporaryDirectory()
    }
    return scratchDirRef.current
  }

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setState({ step: 'parsing' })
    try {
      const scratchDir = await ensureScratchDir()
      const files = await virtualFilesFromExtractedZip(file, scratchDir)
      const found = await findCvLabelManifest(files)
      if (!found) {
        toast.error('No manifest.json found - is this a .cvlabel file?')
        setState({ step: 'select-source' })
        return
      }

      const pairs = findCvLabelPairs(found.manifest, found.dir, files)
      if (pairs.length === 0) {
        toast.error('No samples found in this file')
        setState({ step: 'select-source' })
        return
      }

      setLabelByClassId(
        new Map(
          found.manifest.labels.map((label) => [
            label.id,
            findLabelIdById(project.labels, label.id) ??
              findLabelIdByName(project.labels, label.name)
          ]) as [string, string | undefined][]
        ) as Map<string, string>
      )
      setState({ step: 'mapping', classes: found.manifest.labels, pairs })
    } catch (error) {
      console.error(error)
      toast.error('Failed to read the file')
      setState({ step: 'select-source' })
    }
  }

  const runImport = async () => {
    if (state.step !== 'mapping') return
    const scratchDir = await ensureScratchDir()
    setState({ step: 'importing', progress: 0 })
    try {
      const samples = await cvLabelDatasetToSamples(
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
      toast.error('Failed to import the file')
      setState({ step: 'mapping', classes: state.classes, pairs: state.pairs })
    }
  }

  if (state.step === 'select-source' || state.step === 'parsing') {
    return (
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Select a <code>.cvlabel</code> file exported from this app.
        </Text>
        {state.step === 'parsing' ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Reading file…
            </Text>
          </Group>
        ) : (
          <Button leftSection={<FaFileZipper />} onClick={() => fileInputRef.current?.click()}>
            Choose File
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".cvlabel,.zip"
          data-testid="cvlabel-file-input"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
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
        Found {pairs.length} sample{pairs.length === 1 ? '' : 's'} and {classes.length} label
        {classes.length === 1 ? '' : 's'}. Map each source label to a project label.
      </Text>
      {!hasProjectLabels && (
        <Text size="sm" c="red">
          This project has no labels yet - add one before importing.
        </Text>
      )}
      <ScrollArea style={{ maxHeight: 260 }} type="always" scrollbars="y">
        <Stack gap="sm">
          {classes.map((cvLabelClass) => (
            <Group key={cvLabelClass.id} wrap="nowrap">
              <Text size="sm" flex={1} truncate>
                {cvLabelClass.name}
              </Text>
              <Select
                flex={1}
                data={project.labels.map((label) => ({ value: label.id, label: label.name }))}
                value={labelByClassId.get(cvLabelClass.id) ?? null}
                onChange={(value) => {
                  if (!value) return
                  setLabelByClassId((current) => new Map(current).set(cvLabelClass.id, value))
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
