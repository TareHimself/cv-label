import { BasicListPage } from '@renderer/components/BasicListPage'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { RenameModal } from '@renderer/components/RenameModal'
import { styled } from '@linaria/react'
import {
  Text,
  Button,
  Card,
  Group,
  TextInput,
  Image,
  Stack,
  Flex,
  Skeleton,
  SegmentedControl,
  Center,
  SegmentedControlItem
} from '@mantine/core'
import { IoMdArrowBack } from 'react-icons/io'
import { FaFileImport } from 'react-icons/fa'
import { CiSearch } from 'react-icons/ci'
import { MdDeleteOutline, MdEdit } from 'react-icons/md'
import { useContextMenu } from 'mantine-contextmenu'
import { IProject, ITask, TrainingSplit } from '@shared/types'
import { useSamples } from '@renderer/hooks/useSamples'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { OptimisticSample } from '@renderer/types'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { ImportSamplesModal } from '@renderer/components/sampleIO/ImportSamplesModal'
import { back } from '@renderer/router/appRouter'

const TopContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`

const SPLIT_COMBO_BOX_OPTIONS: SegmentedControlItem[] = [
  {
    value: TrainingSplit.Train,
    label: (
      <Center style={{ gap: 10 }}>
        <span>Train</span>
      </Center>
    )
  },
  {
    value: TrainingSplit.Test,
    label: (
      <Center style={{ gap: 10 }}>
        <span>Test</span>
      </Center>
    )
  },
  {
    value: TrainingSplit.Valid,
    label: (
      <Center style={{ gap: 10 }}>
        <span>Valid</span>
      </Center>
    )
  }
]

const enum SampleStatus {
  InProgress = 'in-progress',
  Completed = 'completed'
}

const STATUS_COMBO_BOX_OPTIONS: SegmentedControlItem[] = [
  {
    value: SampleStatus.InProgress,
    label: (
      <Center style={{ gap: 10 }}>
        <span>In Progress</span>
      </Center>
    )
  },
  {
    value: SampleStatus.Completed,
    label: (
      <Center style={{ gap: 10 }}>
        <span>Completed</span>
      </Center>
    )
  }
]

const SampleCard = ({
  optimisticSample,
  onLabel,
  onEdit,
  onDelete
}: {
  optimisticSample: OptimisticSample
  onLabel: (sampleId: string) => void
  onEdit: (sample: OptimisticSample) => void
  onDelete: (sample: OptimisticSample) => void
}) => {
  const sample = useSyncExternalStore(
    (c) => optimisticSample.subscribe(() => c()),
    () => optimisticSample.resolve()
  )
  const store = useAppStore((s) => s.store)
  const [isLoadingImage, setIsLoadingImage] = useState(true)
  const { showContextMenu } = useContextMenu()
  return (
    <Card
      shadow="sm"
      padding="md"
      onContextMenu={showContextMenu([
        {
          key: 'edit',
          icon: <MdEdit size={16} />,
          title: 'Edit',
          onClick: () => onEdit(optimisticSample)
        },
        {
          key: 'delete',
          icon: <MdDeleteOutline size={16} />,
          title: 'Delete',
          color: 'red',
          onClick: () => onDelete(optimisticSample)
        }
      ])}
    >
      <Card.Section>
        <Skeleton visible={isLoadingImage}>
          <Image
            src={sample.imageUri}
            h={200}
            w={'100%'}
            alt={sample.name}
            decoding="async"
            onLoad={() => setIsLoadingImage(false)}
          />
        </Skeleton>
      </Card.Section>

      <Stack justify={'space-between'} align={'center'} mt={'md'}>
        <Group>
          <Text fw={500} size="xl">
            {sample.name}
          </Text>
        </Group>

        <Flex w={'100%'} justify={'flex-end'} gap={'sm'}>
          <Flex align={'center'} gap={'xs'}>
            <Text fw={500} size="xs">
              Split
            </Text>
            <SegmentedControl
              data={SPLIT_COMBO_BOX_OPTIONS}
              value={sample.split}
              onChange={(split) => {
                const newSplit = split as TrainingSplit
                const { commit, rollback } = optimisticSample.update({
                  split: newSplit
                })
                store
                  .updateSamples([
                    {
                      id: sample.id,
                      split: newSplit
                    }
                  ])
                  .then(() => commit())
                  .catch(() => rollback())
              }}
            />
          </Flex>
          <Flex align={'center'} gap={'xs'}>
            <Text fw={500} size="xs">
              Status
            </Text>
            <SegmentedControl
              data={STATUS_COMBO_BOX_OPTIONS}
              value={sample.completedAt === null ? SampleStatus.InProgress : SampleStatus.Completed}
              onChange={(newStatus) => {
                const newCompletedAt =
                  newStatus === SampleStatus.InProgress ? null : new Date().toISOString()
                const { commit, rollback } = optimisticSample.update({
                  completedAt: newCompletedAt
                })
                store
                  .updateSamples([
                    {
                      id: sample.id,
                      completedAt: newCompletedAt
                    }
                  ])
                  .then(() => commit())
                  .catch(() => rollback())
              }}
            />
          </Flex>
          <Button onClick={() => onLabel(sample.id)}>Label</Button>
        </Flex>
      </Stack>
    </Card>
  )
}
export type SamplesPageProps = {
  project: IProject
  task: ITask
}

export const SamplesPage = ({ project, task }: SamplesPageProps) => {
  const { items, loading, label, remove, createSamples } = useSamples(project, task)
  const store = useAppStore((s) => s.store)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<OptimisticSample | null>(null)
  const [pendingRename, setPendingRename] = useState<OptimisticSample | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const filteredItems = useMemo(
    () => items.filter((s) => s.resolve().name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search]
  )

  return (
    <>
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="sample"
        itemName={pendingDelete?.resolve().name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() =>
          pendingDelete !== null ? remove(pendingDelete.resolve().id) : Promise.resolve()
        }
      />
      <RenameModal
        key={pendingRename?.resolve().id}
        opened={pendingRename !== null}
        entityName="sample"
        initialName={pendingRename?.resolve().name ?? ''}
        onCancel={() => setPendingRename(null)}
        onConfirm={(name) => {
          let result: Promise<unknown> = Promise.resolve()
          if (pendingRename !== null) {
            const { commit, rollback } = pendingRename.update({ name })
            result = store
              .updateSamples([{ id: pendingRename.resolve().id, name }])
              .then(() => commit())
              .catch(() => rollback())
          }
          setPendingRename(null)
          return result
        }}
      />
      <ImportSamplesModal
        opened={isImportOpen}
        project={project}
        onClose={() => setIsImportOpen(false)}
        onImported={async (samples) => {
          await createSamples(samples)
        }}
      />
      <BasicListPage
        top={
          <TopContainer>
            <Group>
              <Button
                leftSection={<IoMdArrowBack />}
                variant="outline"
                onClick={() => {
                  back()
                }}
              >
                Back
              </Button>
              <Button leftSection={<FaFileImport />} onClick={() => setIsImportOpen(true)}>
                Import Samples
              </Button>
            </Group>
            <Group>
              <TextInput
                placeholder="Search"
                rightSection={<CiSearch />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Group>
          </TopContainer>
        }
      >
        <Stack>
          {loading && items.length === 0 && (
            <>
              <Skeleton h={268} />
              <Skeleton h={268} />
              <Skeleton h={268} />
              <Skeleton h={268} />
              <Skeleton h={268} />
            </>
          )}
          {!loading && items.length > 0 && filteredItems.length === 0 && (
            <Text c="dimmed" ta="center" mt="xl">
              No samples match your search.
            </Text>
          )}

          {filteredItems.map((p) => (
            <SampleCard
              key={p.resolve().id}
              optimisticSample={p}
              onLabel={label}
              onEdit={setPendingRename}
              onDelete={setPendingDelete}
            />
          ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
