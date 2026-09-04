import { useCallback, useRef, useState, type FC } from 'react'
import { Button, Group, Loader, Modal, Progress, Stack, Text, TextInput } from '@mantine/core'
import { Dropzone, MIME_TYPES, type FileWithPath } from '@mantine/dropzone'
import toast from 'react-hot-toast'
import { FaFileZipper } from 'react-icons/fa6'
import { FaFileImport } from 'react-icons/fa'
import { useQueryClient } from '@tanstack/react-query'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { makeUUID } from '@shared/utils'
import { ZIndex } from '@renderer/zIndex'
import {
  virtualFilesFromExtractedZip,
  type VirtualFile
} from '@renderer/components/sampleIO/importers/virtualFileSystem'
import {
  cvLabelManifestToNewProject,
  findCvLabelManifest,
  type CvLabelManifest
} from '@renderer/components/sampleIO/importers/cvlabel/parseCvLabel'

type WizardState =
  | { step: 'select-source' }
  | { step: 'parsing' }
  | { step: 'preview'; manifest: CvLabelManifest; dir: string; files: VirtualFile[] }
  | { step: 'importing'; progress: number }

export const ImportProjectButton: FC = () => {
  const store = useAppStore((s) => s.store)
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<WizardState>({ step: 'select-source' })
  const [projectName, setProjectName] = useState('')
  const scratchDirRef = useRef<string | null>(null)

  const ensureScratchDir = async (): Promise<string> => {
    if (!scratchDirRef.current) {
      scratchDirRef.current = await window.system.createTemporaryDirectory()
    }
    return scratchDirRef.current
  }

  const close = useCallback(() => {
    setIsOpen(false)
    setState({ step: 'select-source' })
    if (scratchDirRef.current) {
      window.system.deleteDirectory(scratchDirRef.current).catch(() => {})
      scratchDirRef.current = null
    }
  }, [])

  const handleFileSelected = useCallback(async (files: FileWithPath[]) => {
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

      setProjectName(file.name.replace(/\.(cvlabel|zip)$/i, ''))
      setState({
        step: 'preview',
        manifest: found.manifest,
        dir: found.dir,
        files: extractedFiles
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to read the file')
      setState({ step: 'select-source' })
    }
  }, [])

  const runImport = async () => {
    if (state.step !== 'preview') return
    const scratchDir = await ensureScratchDir()
    setState({ step: 'importing', progress: 0 })
    try {
      const { labels, tasks } = await cvLabelManifestToNewProject(
        state.manifest,
        state.dir,
        state.files,
        scratchDir,
        (completed, total) => {
          setState({
            step: 'importing',
            progress: Math.round((completed / Math.max(total, 1)) * 100)
          })
        }
      )

      const projectId = makeUUID()
      const newProject = await store.createProject(projectId, projectName, labels)
      for (const task of tasks) {
        await store.createTask(newProject.id, task.id, task.name, task.samples)
      }

      await queryClient.invalidateQueries({ queryKey: ['projects', store] })
      close()
    } catch (error) {
      console.error(error)
      toast.error('Failed to import the project')
      setState({ step: 'preview', manifest: state.manifest, dir: state.dir, files: state.files })
    }
  }

  return (
    <>
      <Modal
        opened={isOpen}
        onClose={close}
        title="Import Project"
        centered
        closeOnClickOutside={false}
        zIndex={ZIndex.actionModal}
      >
        {(state.step === 'select-source' || state.step === 'parsing') && (
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Drop a project <code>.cvlabel</code> file exported from this app, or click to browse.
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
              <Button variant="subtle" onClick={close}>
                Cancel
              </Button>
            </Group>
          </Stack>
        )}
        {state.step === 'preview' && (
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Found {state.manifest.tasks.length} task
              {state.manifest.tasks.length === 1 ? '' : 's'} and{' '}
              {state.manifest.tasks.reduce((sum, t) => sum + t.samples.length, 0)} sample
              {state.manifest.tasks.reduce((sum, t) => sum + t.samples.length, 0) === 1 ? '' : 's'}.
              This creates a brand-new project - it never merges into an existing one.
            </Text>
            <TextInput
              label="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setState({ step: 'select-source' })}>
                Back
              </Button>
              <AsyncButton onClick={runImport} disabled={projectName.trim().length === 0}>
                Import
              </AsyncButton>
            </Group>
          </Stack>
        )}
        {state.step === 'importing' && (
          <Stack gap="lg">
            <Progress value={state.progress} animated />
            <Text size="xs" c="dimmed" ta="center">
              Importing project… {state.progress}%
            </Text>
          </Stack>
        )}
      </Modal>
      <Button
        leftSection={<FaFileImport size={14} />}
        variant="outline"
        onClick={() => {
          setState({ step: 'select-source' })
          setIsOpen(true)
        }}
      >
        Import Project
      </Button>
    </>
  )
}
