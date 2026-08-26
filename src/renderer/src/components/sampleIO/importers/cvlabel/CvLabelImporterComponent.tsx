import { useCallback, useEffect, useRef, useState, type FC } from 'react'
import { Button, Group, Loader, Progress, Stack, Text } from '@mantine/core'
import { Dropzone, MIME_TYPES, type FileWithPath } from '@mantine/dropzone'
import toast from 'react-hot-toast'
import { FaFileZipper } from 'react-icons/fa6'
import type { SampleImporterComponentProps } from '../../types'
import { LabelMapper } from '../../LabelMapper'
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

type CvLabelImporterComponentProps = SampleImporterComponentProps & {
  /** Skips the drop/browse step, feeding this file straight into parsing - for a caller (e.g. CreateTaskButton's own drop target) that already has the file in hand. */
  initialFile?: FileWithPath
}

export const CvLabelImporterComponent: FC<CvLabelImporterComponentProps> = ({
  project,
  onComplete,
  onCancel,
  initialFile
}) => {
  const [state, setState] = useState<WizardState>(
    initialFile ? { step: 'parsing' } : { step: 'select-source' }
  )
  const [labelByClassId, setLabelByClassId] = useState<Map<string, string | null>>(new Map())
  const scratchDirRef = useRef<string | null>(null)

  const ensureScratchDir = async (): Promise<string> => {
    if (!scratchDirRef.current) {
      scratchDirRef.current = await window.system.createTemporaryDirectory()
    }
    return scratchDirRef.current
  }

  const handleFileSelected = useCallback(
    async (files: FileWithPath[]) => {
      const file = files[0]
      if (!file) return

      setState({ step: 'parsing' })
      try {
        const scratchDir = await ensureScratchDir()
        const extractedFiles = await virtualFilesFromExtractedZip(file, scratchDir)
        const found = await findCvLabelManifest(extractedFiles)
        if (!found) {
          toast.error('No manifest.json found - is this a .cvlabel file?')
          setState({ step: 'select-source' })
          return
        }

        const pairs = findCvLabelPairs(found.manifest, found.dir, extractedFiles)
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
          ) as Map<string, string | null>
        )
        setState({ step: 'mapping', classes: found.manifest.labels, pairs })
      } catch (error) {
        console.error(error)
        toast.error('Failed to read the file')
        setState({ step: 'select-source' })
      }
    },
    [project]
  )

  // Mirrors Dropzone's own onDrop for this file - re-fires per distinct initialFile instance. Deferred a microtask since handleFileSelected's synchronous setState would flag as a cascading-render risk called directly in the effect body.
  useEffect(() => {
    if (initialFile) {
      void Promise.resolve().then(() => handleFileSelected([initialFile]))
    }
  }, [initialFile, handleFileSelected])

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
          Drop a <code>.cvlabel</code> file exported from this app, or click to browse.
        </Text>
        {state.step === 'parsing' ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Reading file…
            </Text>
          </Group>
        ) : (
          <Dropzone
            // .cvlabel has no OS mime type, so File.type is typically empty - matching by extension is what actually lets it through, not the mime key.
            accept={{ [MIME_TYPES.zip]: ['.cvlabel', '.zip'] }}
            multiple={false}
            onDrop={(files) => handleFileSelected(files)}
          >
            <Group justify="center" gap="xl" mih={160} style={{ pointerEvents: 'none' }}>
              <Stack align="center" gap={4}>
                <FaFileZipper size={28} opacity={0.6} />
                <Text size="sm" c="dimmed">
                  Drop a .cvlabel file here, or click to browse
                </Text>
              </Stack>
            </Group>
          </Dropzone>
        )}
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
      <LabelMapper
        items={classes}
        options={project.labels}
        mapping={labelByClassId}
        onChange={(id, value) => setLabelByClassId((current) => new Map(current).set(id, value))}
        disabled={!hasProjectLabels}
      />
      <Group justify="flex-end">
        <Button variant="outline" onClick={() => setState({ step: 'select-source' })}>
          Back
        </Button>
        <Button
          onClick={runImport}
          disabled={
            !hasProjectLabels || classes.some((c) => labelByClassId.get(c.id) === undefined)
          }
        >
          Import
        </Button>
      </Group>
    </Stack>
  )
}
