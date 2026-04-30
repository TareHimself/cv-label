import { BasicListPage } from '@renderer/components/BasicListPage'
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
import { useNavigate } from 'react-router'
import { TrainingSplit } from '@shared/types'
import { useSamples } from '@renderer/hooks/useSamples'
import { useState, useSyncExternalStore } from 'react'
import { OptimisticSample } from '@renderer/types'
import { useAppStore } from '@renderer/hooks/useAppStore'

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
  onLabel
}: {
  optimisticSample: OptimisticSample
  onLabel: (sampleId: string) => void
}) => {
  const sample = useSyncExternalStore(
    (c) => optimisticSample.subscribe(() => c()),
    () => optimisticSample.resolve()
  )
  const store = useAppStore((s) => s.store)
  const [isLoadingImage, setIsLoadingImage] = useState(true)
  return (
    <Card shadow="sm" padding="md">
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
export const SamplesPage = () => {
  const { items, loading, label } = useSamples()
  const navigate = useNavigate()

  return (
    <BasicListPage
      top={
        <TopContainer>
          <Group>
            <Button
              leftSection={<IoMdArrowBack />}
              variant="outline"
              onClick={() => {
                navigate(-1)
              }}
            >
              Back
            </Button>
            <Button leftSection={<FaFileImport />} onClick={() => {}}>
              Import Samples
            </Button>
          </Group>
          <Group>
            <TextInput placeholder="Search" rightSection={<CiSearch />} />
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

        {/* {items.length > 0 && (
          <Flex w={1000} h={1000}>
            <Labeler
              sample={items[sampleIndex]}
              isCreatingAnnotation={false}
              labels={project.labels}
            />
          </Flex>
        )} */}

        {items.map((p) => (
          <SampleCard key={p.resolve().id} optimisticSample={p} onLabel={label} />
        ))}
      </Stack>
    </BasicListPage>
  )
}
