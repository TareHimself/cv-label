import { useEffect, useState, type FC } from 'react'
import {
  Box,
  Button,
  Center,
  Group,
  Image,
  Loader,
  Progress,
  Select,
  Stack,
  Text
} from '@mantine/core'
import { IoMdArrowBack } from 'react-icons/io'
import type { IProject, ITask } from '@shared/types'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { BasicListPage } from '@renderer/components/BasicListPage'
import { BasicListPageTopBar } from '@renderer/components/BasicListPageTopBar'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { useTasks } from '@renderer/hooks/useTasks'
import {
  useCopyAnnotations,
  type CopyAnnotationsPair,
  type CopyAnnotationsProgress
} from '@renderer/hooks/useCopyAnnotations'
import { toOptimisticSample } from '@renderer/util/toOptimisticSample'
import type { OptimisticSample } from '@renderer/types'
import { back } from '@renderer/router/appRouter'

const SKIP_VALUE = '__skip__'
const THUMBNAIL_SIZE = 96

const summarize = (progress: CopyAnnotationsProgress) => {
  const copiedInto = progress.completed - progress.failures.length
  const parts = [`${progress.copied} annotation${progress.copied === 1 ? '' : 's'} copied`]
  parts.push(`across ${copiedInto} sample${copiedInto === 1 ? '' : 's'}`)
  if (progress.alreadyLabeled > 0) parts.push(`${progress.alreadyLabeled} already labeled`)
  if (progress.dimensionMismatch > 0) parts.push(`${progress.dimensionMismatch} size mismatch`)
  if (progress.duplicateDestination > 0)
    parts.push(`${progress.duplicateDestination} duplicate mapping(s)`)
  if (progress.failures.length > 0) parts.push(`${progress.failures.length} failed`)
  return parts.join(', ')
}

type SampleMappingRowsProps = {
  sourceSamples: OptimisticSample[]
  destinationSamples: OptimisticSample[]
  mapping: Map<string, string | null>
  onChange: (sourceSampleId: string, destinationSampleId: string | null) => void
}

/** Two lines per source sample: its own thumbnail + full name on top, then a Select to
 *  pick which destination sample it maps to (or Skip) plus a live thumbnail preview of
 *  whichever destination is currently picked - a closed Select can only show text, and
 *  visually confirming "this is the same page" is the whole point when the destination
 *  task's names/text are in a different language. The name gets its own line rather than
 *  sharing one with the Select (source and destination names here are typically long and
 *  differ only by a suffix) so it never has to compete with the Select for width and get
 *  truncated illegibly. Colocated here rather than folded into the shared LabelMapper,
 *  which 6 importer/exporter callers depend on for a plain text-only "map to a project
 *  label" row - bolting a thumbnail concept onto it would leak this one caller's needs
 *  into all of them. */
const SampleMappingRows: FC<SampleMappingRowsProps> = ({
  sourceSamples,
  destinationSamples,
  mapping,
  onChange
}) => {
  const destinationCounts = new Map<string, number>()
  for (const destinationId of mapping.values()) {
    if (destinationId === null) continue
    destinationCounts.set(destinationId, (destinationCounts.get(destinationId) ?? 0) + 1)
  }
  const seenDestinationIds = new Set<string>()

  return (
    <Stack gap="sm">
      {sourceSamples.map((sample) => {
        const source = sample.resolve()
        const destinationId = mapping.get(source.id) ?? null
        const destination = destinationSamples.find((d) => d.resolve().id === destinationId)
        const isDuplicate =
          destinationId !== null &&
          (destinationCounts.get(destinationId) ?? 0) > 1 &&
          seenDestinationIds.has(destinationId)
        if (destinationId !== null) seenDestinationIds.add(destinationId)

        return (
          <Stack key={source.id} gap={4}>
            <Group wrap="nowrap" gap={8}>
              <Image
                src={source.imageUri}
                w={THUMBNAIL_SIZE}
                h={THUMBNAIL_SIZE}
                radius="sm"
                fit="cover"
              />
              <Text size="sm" fw={500}>
                {source.name}
              </Text>
            </Group>
            <Group wrap="nowrap" pl={THUMBNAIL_SIZE + 8}>
              <Select
                flex={1}
                data={[
                  { value: SKIP_VALUE, label: 'Skip' },
                  ...destinationSamples.map((d) => ({
                    value: d.resolve().id,
                    label: d.resolve().name
                  }))
                ]}
                value={destinationId ?? SKIP_VALUE}
                onChange={(value) => onChange(source.id, value === SKIP_VALUE ? null : value)}
                disabled={destinationSamples.length === 0}
                allowDeselect={false}
                searchable
              />
              {destination ? (
                <Image
                  src={destination.resolve().imageUri}
                  w={THUMBNAIL_SIZE}
                  h={THUMBNAIL_SIZE}
                  radius="sm"
                  fit="cover"
                />
              ) : (
                <Box
                  w={THUMBNAIL_SIZE}
                  h={THUMBNAIL_SIZE}
                  style={{
                    borderRadius: 'var(--mantine-radius-sm)',
                    border:
                      '1px dashed light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))',
                    flexShrink: 0
                  }}
                />
              )}
            </Group>
            {isDuplicate && (
              <Text size="xs" c="red" pl={THUMBNAIL_SIZE + 8}>
                Also mapped from another sample - only the first copy will run.
              </Text>
            )}
          </Stack>
        )
      })}
    </Stack>
  )
}

type CopyAnnotationsRunStepProps = {
  sourceSamples: OptimisticSample[]
  destinationTask: ITask
  destinationSamples: OptimisticSample[]
  onBack: () => void
}

const CopyAnnotationsRunStep: FC<CopyAnnotationsRunStepProps> = ({
  sourceSamples,
  destinationTask,
  destinationSamples,
  onBack
}) => {
  const { run, progress, isRunning } = useCopyAnnotations(destinationTask.id)
  const [hasStarted, setHasStarted] = useState(false)
  const [mapping, setMapping] = useState<Map<string, string | null>>(
    () =>
      new Map(
        sourceSamples.map((s, i) => [s.resolve().id, destinationSamples[i]?.resolve().id ?? null])
      )
  )

  if (destinationSamples.length === 0) {
    return (
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          &quot;{destinationTask.name}&quot; has no samples.
        </Text>
        <Group justify="flex-end">
          <Button variant="outline" leftSection={<IoMdArrowBack />} onClick={onBack}>
            Back
          </Button>
        </Group>
      </Stack>
    )
  }

  const startRun = async () => {
    const pairs: CopyAnnotationsPair[] = sourceSamples
      .map((source) => {
        const destinationId = mapping.get(source.resolve().id)
        const destination = destinationSamples.find((d) => d.resolve().id === destinationId)
        return destination ? { source, destination } : null
      })
      .filter((pair): pair is CopyAnnotationsPair => pair !== null)

    setHasStarted(true)
    await run(pairs)
  }

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100

  if (hasStarted) {
    return (
      <Stack gap="lg">
        <Progress value={percent} animated={isRunning} />
        <Text size="sm" c="dimmed" ta="center">
          {isRunning ? `Copying… ${progress.completed}/${progress.total}` : summarize(progress)}
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
        Into &quot;{destinationTask.name}&quot;, matched by list position - check the thumbnails and
        adjust any row that&apos;s off. Samples already annotated are skipped.
      </Text>
      <SampleMappingRows
        sourceSamples={sourceSamples}
        destinationSamples={destinationSamples}
        mapping={mapping}
        onChange={(sourceId, destinationId) =>
          setMapping((current) => new Map(current).set(sourceId, destinationId))
        }
      />
      <Group justify="flex-end">
        <Button variant="outline" leftSection={<IoMdArrowBack />} onClick={onBack}>
          Back
        </Button>
        <AsyncButton onClick={startRun}>Run</AsyncButton>
      </Group>
    </Stack>
  )
}

type Step =
  | { step: 'pick-destination' }
  | { step: 'run'; destinationTask: ITask; destinationSamples: OptimisticSample[] }

export type CopyAnnotationsPageProps = {
  project: IProject
  sourceTask: ITask
}

export const CopyAnnotationsPage = ({ project, sourceTask }: CopyAnnotationsPageProps) => {
  const store = useAppStore((s) => s.store)
  const { items: allTasks } = useTasks(project)
  const [sourceSamples, setSourceSamples] = useState<OptimisticSample[] | null>(null)
  const [step, setStep] = useState<Step>({ step: 'pick-destination' })
  const [destinationTaskId, setDestinationTaskId] = useState<string | null>(null)

  useEffect(() => {
    store
      .getSamplesForTask(sourceTask.id)
      .then((samples) => setSourceSamples(samples.map(toOptimisticSample)))
  }, [sourceTask.id, store])

  const destinationOptions = allTasks.filter((t) => t.id !== sourceTask.id)

  const continueToMapping = async () => {
    const destinationTask = destinationOptions.find((t) => t.id === destinationTaskId)
    if (destinationTask === undefined) return
    const samples = await store.getSamplesForTask(destinationTask.id)
    setStep({
      step: 'run',
      destinationTask,
      destinationSamples: samples.map(toOptimisticSample)
    })
  }

  return (
    <BasicListPage
      wide
      top={
        <BasicListPageTopBar>
          <Group>
            <Button leftSection={<IoMdArrowBack />} variant="outline" onClick={() => back()}>
              Back
            </Button>
            <Text fw={600} size="lg">
              Copy Annotations from &quot;{sourceTask.name}&quot;
            </Text>
          </Group>
        </BasicListPageTopBar>
      }
    >
      {sourceSamples === null ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : sourceSamples.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          &quot;{sourceTask.name}&quot; has no samples to copy annotations from.
        </Text>
      ) : step.step === 'pick-destination' ? (
        destinationOptions.length === 0 ? (
          <Text c="dimmed" ta="center" mt="xl">
            This project has no other tasks yet - create one with the matching pages first.
          </Text>
        ) : (
          <Stack gap="lg" maw={420}>
            <Text size="sm" c="dimmed">
              Copy every sample&apos;s annotations into another task in this project.
            </Text>
            <Select
              label="Destination task"
              placeholder="Select a task"
              data={destinationOptions.map((t) => ({ value: t.id, label: t.name }))}
              value={destinationTaskId}
              onChange={setDestinationTaskId}
              searchable
            />
            <Group justify="flex-end">
              <AsyncButton disabled={destinationTaskId === null} onClick={continueToMapping}>
                Continue
              </AsyncButton>
            </Group>
          </Stack>
        )
      ) : (
        <CopyAnnotationsRunStep
          key={step.destinationTask.id}
          sourceSamples={sourceSamples}
          destinationTask={step.destinationTask}
          destinationSamples={step.destinationSamples}
          onBack={() => setStep({ step: 'pick-destination' })}
        />
      )}
    </BasicListPage>
  )
}
