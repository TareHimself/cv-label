import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import toast from 'react-hot-toast'
import { MdAdd, MdDeleteOutline, MdSettings } from 'react-icons/md'
import { IoMdArrowBack } from 'react-icons/io'
import type { IAnnotator, IProject, ITask } from '@shared/types'
import { errorToString, makeUUID } from '@shared/utils'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { useAnnotators } from '@renderer/hooks/useAnnotators'
import { useAnnotatorRuntime } from '@renderer/hooks/useAnnotatorRuntime'
import { useRunAnnotator, type RunAnnotatorProgress } from '@renderer/hooks/useRunAnnotator'
import { connectToAnnotator } from '@renderer/api/ExternalAnnotator'
import { findLabelIdByName } from '@renderer/components/sampleIO/importers/matchLabel'
import type { AnnotatorLabel, OptimisticSample } from '@renderer/types'
import { ZIndex } from '@renderer/zIndex'

const IGNORE_VALUE = '__ignore__'

type HeaderRow = { id: string; key: string; value: string }

type Step =
  | { step: 'list' }
  | { step: 'form'; name: string; url: string; headerRows: HeaderRow[] }
  | { step: 'run'; annotator: IAnnotator; samples: OptimisticSample[] }
  | { step: 'edit'; annotator: IAnnotator; name: string; url: string; headerRows: HeaderRow[] }

/** Best-effort mapping by matching label names - never persisted, only seeds the in-memory mapping the first time an annotator runs against a project. */
const guessMapping = (
  labels: AnnotatorLabel[],
  project: IProject
): Record<string, string | null> => {
  const mapping: Record<string, string | null> = {}
  for (const label of labels) {
    mapping[label.id] = findLabelIdByName(project.labels, label.name) ?? null
  }
  return mapping
}

const summarize = (progress: RunAnnotatorProgress) => {
  const labeled = progress.completed - progress.failures.length
  const parts = [`${progress.created} annotation${progress.created === 1 ? '' : 's'} added`]
  parts.push(`across ${labeled} image${labeled === 1 ? '' : 's'}`)
  if (progress.skipped > 0) parts.push(`${progress.skipped} prediction(s) skipped`)
  if (progress.alreadyLabeled > 0) parts.push(`${progress.alreadyLabeled} already labeled`)
  if (progress.failures.length > 0) parts.push(`${progress.failures.length} failed`)
  return parts.join(', ')
}

type AnnotatorFieldsValue = { name: string; url: string; headerRows: HeaderRow[] }

type AnnotatorFormFieldsProps = {
  value: AnnotatorFieldsValue
  onChange: (value: AnnotatorFieldsValue) => void
}

/** Name/URL/headers fields - shared between the "Add Annotator" form and the settings/cog "edit" screen, which differ only in what they do with the result. */
const AnnotatorFormFields: FC<AnnotatorFormFieldsProps> = ({ value, onChange }) => (
  <>
    <TextInput
      label="Name"
      value={value.name}
      onChange={(e) => onChange({ ...value, name: e.target.value })}
      data-autofocus
    />
    <TextInput
      label="URL"
      description="Base URL - must expose GET <url>/connect and POST <url>/predict"
      placeholder="https://example.com/my-model"
      value={value.url}
      onChange={(e) => onChange({ ...value, url: e.target.value })}
    />
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Headers
      </Text>
      {value.headerRows.map((row) => (
        <Group key={row.id} wrap="nowrap">
          <TextInput
            flex={1}
            placeholder="Header name"
            value={row.key}
            onChange={(e) =>
              onChange({
                ...value,
                headerRows: value.headerRows.map((r) =>
                  r.id === row.id ? { ...r, key: e.target.value } : r
                )
              })
            }
          />
          <TextInput
            flex={1}
            placeholder="Value"
            value={row.value}
            onChange={(e) =>
              onChange({
                ...value,
                headerRows: value.headerRows.map((r) =>
                  r.id === row.id ? { ...r, value: e.target.value } : r
                )
              })
            }
          />
          <ActionIcon
            aria-label="Remove header"
            variant="subtle"
            color="red"
            onClick={() =>
              onChange({ ...value, headerRows: value.headerRows.filter((r) => r.id !== row.id) })
            }
          >
            <MdDeleteOutline size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        size="xs"
        variant="subtle"
        leftSection={<MdAdd />}
        onClick={() =>
          onChange({
            ...value,
            headerRows: [...value.headerRows, { id: makeUUID(), key: '', value: '' }]
          })
        }
      >
        Add Header
      </Button>
    </Stack>
  </>
)

type AnnotatorMappingFieldsProps = {
  project: IProject
  labels: AnnotatorLabel[]
  mapping: Record<string, string | null>
  onChangeMapping: (labelId: string, value: string) => void
}

/** The per-label "map to a project label, or Ignore" editor - shared between the pre-run review screen and the settings/cog "edit" screen. */
const AnnotatorMappingFields: FC<AnnotatorMappingFieldsProps> = ({
  project,
  labels,
  mapping,
  onChangeMapping
}) => (
  <Stack gap="sm">
    <Text size="sm" c="dimmed">
      Map each of this annotator&apos;s labels to a project label, or leave it as Ignore.
    </Text>
    {labels.length === 0 && (
      <Text size="sm" c="dimmed">
        This annotator reported no labels.
      </Text>
    )}
    <ScrollArea style={{ maxHeight: 260 }} type="always" scrollbars="y">
      <Stack gap="sm">
        {labels.map((label) => (
          <Group key={label.id} wrap="nowrap">
            <Text size="sm" flex={1} truncate>
              {label.name}
            </Text>
            <Select
              flex={1}
              data={[
                { value: IGNORE_VALUE, label: 'Ignore' },
                ...project.labels.map((l) => ({ value: l.id, label: l.name }))
              ]}
              value={mapping[label.id] ?? IGNORE_VALUE}
              onChange={(value) => onChangeMapping(label.id, value ?? IGNORE_VALUE)}
              comboboxProps={{ zIndex: ZIndex.actionModalContent }}
              allowDeselect={false}
            />
          </Group>
        ))}
      </Stack>
    </ScrollArea>
  </Stack>
)

type AnnotatorRunStepProps = {
  project: IProject
  samples: OptimisticSample[]
  annotator: IAnnotator
  /** Owned by the parent so it survives this component's own mount/unmount, letting a run that should start immediately be kicked off from the same click handler - see AnnotatorsModal's startRun. */
  run: ReturnType<typeof useRunAnnotator>['run']
  progress: RunAnnotatorProgress
  isRunning: boolean
  /** Whether a run has been kicked off at all - the only reliable "show progress vs. show the mapping editor" signal (isRunning flips back, progress.total can be legitimately 0). */
  hasRun: boolean
  /** Also used by the post-run "Done" button - returns to the annotator list rather than closing the whole modal. */
  onBack: () => void
}

const AnnotatorRunStep: FC<AnnotatorRunStepProps> = ({
  project,
  samples,
  annotator,
  run,
  progress,
  isRunning,
  hasRun,
  onBack
}) => {
  const entry = useAnnotatorRuntime((s) => s.entries[annotator.id])
  const setMapping = useAnnotatorRuntime((s) => s.setMapping)
  const mapping = entry?.mappingByProjectId[project.id] ?? {}

  // Fires exactly on a running -> finished transition, never on mount.
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !isRunning) {
      toast.success(summarize(progress))
    }
    wasRunning.current = isRunning
  }, [isRunning, progress])

  const labels = entry?.labels ?? []

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100

  if (hasRun) {
    return (
      <Stack gap="lg">
        <Progress value={percent} animated={isRunning} />
        <Text size="sm" c="dimmed" ta="center">
          {isRunning ? `Labeling… ${progress.completed}/${progress.total}` : summarize(progress)}
        </Text>
        {progress.failures.length > 0 && !isRunning && (
          <Stack gap={4}>
            {progress.failures.map((failure) => (
              <Text key={failure.sampleId} size="xs" c="red">
                {failure.sampleName}: {failure.error}
              </Text>
            ))}
          </Stack>
        )}
        <Group justify="flex-end">
          <Button disabled={isRunning} onClick={onBack}>
            Done
          </Button>
        </Group>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Runs against every sample in this set that has no annotations yet ({samples.length} sample
        {samples.length === 1 ? '' : 's'} selected).
      </Text>
      <AnnotatorMappingFields
        project={project}
        labels={labels}
        mapping={mapping}
        onChangeMapping={(labelId, value) =>
          setMapping(annotator.id, project.id, {
            ...mapping,
            [labelId]: value === IGNORE_VALUE ? null : value
          })
        }
      />
      <Group justify="flex-end">
        <Button variant="outline" leftSection={<IoMdArrowBack />} onClick={onBack}>
          Back
        </Button>
        <AsyncButton onClick={() => run(annotator, mapping, samples)}>Run</AsyncButton>
      </Group>
    </Stack>
  )
}

export type AnnotatorsModalProps = {
  opened: boolean
  project: IProject
  /** Only passed when there's something to run against - absent means management-only (e.g. ProjectsPage's context-menu entry). Usually one task, but a Tasks-page batch run can pass several. */
  tasks?: ITask[]
  samples?: OptimisticSample[]
  onClose: () => void
}

export const AnnotatorsModal: FC<AnnotatorsModalProps> = ({
  opened,
  project,
  tasks,
  samples,
  onClose
}) => {
  const { items, isLoading, create, update, remove } = useAnnotators()
  const activate = useAnnotatorRuntime((s) => s.activate)
  const setMapping = useAnnotatorRuntime((s) => s.setMapping)
  const forget = useAnnotatorRuntime((s) => s.forget)
  // Owned here, not AnnotatorRunStep, so a run whose mapping is already known can start directly from the click that decided that - see startRun below.
  const taskIds = useMemo(() => tasks?.map((t) => t.id) ?? [], [tasks])
  const { run, reset: resetRun, progress, isRunning, hasRun } = useRunAnnotator(taskIds)
  const [step, setStep] = useState<Step>({ step: 'list' })
  const [wasOpened, setWasOpened] = useState(opened)
  const [pendingDelete, setPendingDelete] = useState<IAnnotator | null>(null)
  // Only meaningful while step.step === 'edit' - read unconditionally since hooks can't be conditional.
  const editRuntimeEntry = useAnnotatorRuntime((s) =>
    step.step === 'edit' ? s.entries[step.annotator.id] : undefined
  )

  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) {
      setStep({ step: 'list' })
    }
  }

  const canRun = tasks !== undefined && tasks.length > 0 && samples !== undefined

  const openForm = () => setStep({ step: 'form', name: '', url: '', headerRows: [] })

  const headerRowsToRecord = (rows: HeaderRow[]): Record<string, string> =>
    Object.fromEntries(
      rows.filter((row) => row.key.trim().length > 0).map((row) => [row.key.trim(), row.value])
    )

  const connectFromForm = async () => {
    if (step.step !== 'form') return
    const name = step.name.trim()
    const url = step.url.trim()
    if (name.length === 0 || url.length === 0) {
      toast.error('Name and URL are required')
      return
    }

    const headers = headerRowsToRecord(step.headerRows)
    try {
      const labels = await connectToAnnotator(url, headers)
      const id = await create(name, url, headers)
      activate(id, labels)
      setStep({ step: 'list' })
    } catch (error) {
      toast.error(errorToString(error))
    }
  }

  /** Connects (if not yet activated this session) and seeds a best-effort mapping - shared by the Run and settings/cog flows, which differ only in what they do once activated. */
  const ensureActivated = async (annotator: IAnnotator): Promise<AnnotatorLabel[] | undefined> => {
    let labels = useAnnotatorRuntime.getState().entries[annotator.id]?.labels
    if (labels === undefined) {
      try {
        labels = await connectToAnnotator(annotator.url, annotator.headers)
        activate(annotator.id, labels)
      } catch (error) {
        toast.error(errorToString(error))
        return undefined
      }
    }

    if (
      useAnnotatorRuntime.getState().entries[annotator.id]?.mappingByProjectId[project.id] ===
      undefined
    ) {
      setMapping(annotator.id, project.id, guessMapping(labels, project))
    }

    return labels
  }

  const startRun = async (annotator: IAnnotator) => {
    if (tasks === undefined || tasks.length === 0 || samples === undefined) return

    // Captured before ensureActivated seeds a fresh guess - only an already-known mapping skips the review step.
    const hadMapping =
      useAnnotatorRuntime.getState().entries[annotator.id]?.mappingByProjectId[project.id] !==
      undefined

    const labels = await ensureActivated(annotator)
    if (labels === undefined) return

    // Clears whatever an earlier run in this same modal session left behind - run/progress/isRunning aren't remounted fresh per visit to the 'run' step.
    resetRun()
    setStep({ step: 'run', annotator, samples })

    if (hadMapping) {
      // Not awaited on purpose - blocking here would keep the list row's own Run button spinning for the whole run.
      const mapping =
        useAnnotatorRuntime.getState().entries[annotator.id]?.mappingByProjectId[project.id] ?? {}
      void run(annotator, mapping, samples)
    }
  }

  const openEdit = async (annotator: IAnnotator) => {
    setStep({
      step: 'edit',
      annotator,
      name: annotator.name,
      url: annotator.url,
      headerRows: Object.entries(annotator.headers).map(([key, value]) => ({
        id: makeUUID(),
        key,
        value
      }))
    })
    await ensureActivated(annotator)
  }

  const saveEdit = async () => {
    if (step.step !== 'edit') return
    const name = step.name.trim()
    const url = step.url.trim()
    if (name.length === 0 || url.length === 0) {
      toast.error('Name and URL are required')
      return
    }

    const headers = headerRowsToRecord(step.headerRows)
    // A changed URL means a possibly different service - drop cached labels/mapping and reconnect fresh.
    if (url !== step.annotator.url) {
      forget(step.annotator.id)
    }
    await update(step.annotator.id, name, url, headers)
    setStep({ step: 'list' })
  }

  const listTitle = canRun ? 'Auto-label' : 'Manage Annotators'
  const title =
    step.step === 'form' ? 'Connect Annotator' : step.step === 'run' ? 'Auto-label' : listTitle

  return (
    <>
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="annotator"
        itemName={pendingDelete?.name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete === null) return Promise.resolve()
          const id = pendingDelete.id
          return remove(id).then(() => forget(id))
        }}
      />
      <Modal
        opened={opened}
        onClose={onClose}
        title={title}
        centered
        closeOnClickOutside={false}
        zIndex={ZIndex.actionModal}
      >
        {step.step === 'list' && (
          <Stack gap="lg">
            <Stack gap="xs">
              {!isLoading && items.length === 0 && (
                <Text c="dimmed" size="sm">
                  No annotators configured yet.
                </Text>
              )}
              {items.map((annotator) => (
                <Group key={annotator.id} justify="space-between" wrap="nowrap">
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={500} truncate>
                      {annotator.name}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {annotator.url}
                    </Text>
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    {canRun && (
                      <AsyncButton size="xs" variant="outline" onClick={() => startRun(annotator)}>
                        Run
                      </AsyncButton>
                    )}
                    <ActionIcon
                      aria-label={`Edit ${annotator.name}`}
                      variant="subtle"
                      onClick={() => openEdit(annotator)}
                    >
                      <MdSettings size={16} />
                    </ActionIcon>
                    <ActionIcon
                      aria-label={`Delete ${annotator.name}`}
                      variant="subtle"
                      color="red"
                      onClick={() => setPendingDelete(annotator)}
                    >
                      <MdDeleteOutline size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
            </Stack>
            <Group justify="space-between">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button leftSection={<MdAdd />} onClick={openForm}>
                Add Annotator
              </Button>
            </Group>
          </Stack>
        )}

        {step.step === 'form' && (
          <Stack gap="lg">
            <AnnotatorFormFields
              value={step}
              onChange={(next) => setStep({ step: 'form', ...next })}
            />
            <Group justify="flex-end">
              <Button
                variant="outline"
                leftSection={<IoMdArrowBack />}
                onClick={() => setStep({ step: 'list' })}
              >
                Back
              </Button>
              <AsyncButton onClick={connectFromForm}>Connect</AsyncButton>
            </Group>
          </Stack>
        )}

        {step.step === 'run' && (
          <AnnotatorRunStep
            project={project}
            samples={step.samples}
            annotator={step.annotator}
            run={run}
            progress={progress}
            isRunning={isRunning}
            hasRun={hasRun}
            onBack={() => setStep({ step: 'list' })}
          />
        )}

        {step.step === 'edit' && (
          <Stack gap="lg">
            <AnnotatorFormFields
              value={step}
              onChange={(next) => setStep({ step: 'edit', annotator: step.annotator, ...next })}
            />
            <AnnotatorMappingFields
              project={project}
              labels={editRuntimeEntry?.labels ?? []}
              mapping={editRuntimeEntry?.mappingByProjectId[project.id] ?? {}}
              onChangeMapping={(labelId, value) =>
                setMapping(step.annotator.id, project.id, {
                  ...(editRuntimeEntry?.mappingByProjectId[project.id] ?? {}),
                  [labelId]: value === IGNORE_VALUE ? null : value
                })
              }
            />
            <Group justify="flex-end">
              <Button
                variant="outline"
                leftSection={<IoMdArrowBack />}
                onClick={() => setStep({ step: 'list' })}
              >
                Back
              </Button>
              <AsyncButton onClick={saveEdit}>Save</AsyncButton>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  )
}
