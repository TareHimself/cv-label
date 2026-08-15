import { styled } from '@linaria/react'
import {
  Button,
  Flex,
  MantineSize,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  SegmentedControlProps,
  Tooltip,
  VisuallyHidden
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { Labeler } from '@renderer/components/Labeler'
import { useLabeler } from '@renderer/hooks/useLabeler'
import { LabelerMode, OptimisticSample } from '@renderer/types'
import { useCallback, useLayoutEffect, useState } from 'react'
import { IoMdArrowBack } from 'react-icons/io'
import { PiHandPalmBold, PiPolygonLight } from 'react-icons/pi'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { MdFormatListBulleted } from 'react-icons/md'
import { ILabel, IProject, ITask, OmitV2 } from '@shared/types'
import { mod } from '@shared/utils'
import { useAppStore } from '@renderer/hooks/useAppStore'
import { back, useOnRouteEnter, useOnRouteLeave } from '@renderer/router/appRouter'
import { AnnotationsDrawer } from './AnnotationsDrawer'

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* display: flex;
  flex-direction: column; */
`
const StyledLabeler = styled(Labeler)`
  width: 100%;
  height: 100%;
`

type LabelerModeControlProps = {
  value: LabelerMode
  onChange: (newValue: LabelerMode) => void
  size?: MantineSize
}
const ICON_SIZE = 15
const ICON_STYLE: React.CSSProperties = {
  margin: '-5px'
}
const LabelerModeControl = ({ value, onChange, size = 'md' }: LabelerModeControlProps) => (
  <SegmentedControl
    size={size}
    value={value}
    onChange={(newMode) => {
      onChange(newMode as LabelerMode)
    }}
    styles={{
      label: {
        display: 'flex',
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 0
      },
      innerLabel: {
        display: 'flex'
      },
      control: {
        aspectRatio: 1,
        display: 'flex'
      }
    }}
    data={[
      {
        value: LabelerMode.Select,
        label: (
          <Tooltip label="Select">
            <span>
              <PiHandPalmBold size={ICON_SIZE} style={ICON_STYLE} />
              <VisuallyHidden>Select</VisuallyHidden>
            </span>
          </Tooltip>
        )
      },
      {
        value: LabelerMode.CreateBox,
        label: (
          <Tooltip label="Create Boxes">
            <span>
              <BsBoundingBoxCircles size={ICON_SIZE} style={ICON_STYLE} />
              <VisuallyHidden>Create Boxes</VisuallyHidden>
            </span>
          </Tooltip>
        )
      },
      {
        value: LabelerMode.CreatePolygon,
        label: (
          <Tooltip label="Create Polygon">
            <span>
              <PiPolygonLight size={ICON_SIZE} style={ICON_STYLE} />
              <VisuallyHidden>Create Polygon</VisuallyHidden>
            </span>
          </Tooltip>
        )
      }
    ]}
  />
)

// Labels grow unbounded (a project can have dozens), so this row needs to size to its
// natural content width and scroll rather than stretch every item to fill the bar -
// the fixed cap keeps the bottom bar's other controls from getting pushed off-screen.
const LABEL_LIST_MAX_WIDTH = 'min(420px, 40vw)'

const TextSegmentedControl = ({
  scrollable,
  ...props
}: OmitV2<SegmentedControlProps, 'styles'> & { scrollable?: boolean }) => {
  const control = (
    <SegmentedControl
      size="sm"
      styles={{
        root: scrollable ? { display: 'inline-flex', width: 'max-content' } : undefined,
        label: {
          display: 'flex',
          flex: scrollable ? undefined : 1,
          justifyContent: 'center',
          alignItems: 'center',
          whiteSpace: 'nowrap'
        },
        innerLabel: {
          display: 'flex'
        },
        control: {
          // aspectRatio: 1,
          display: 'flex'
        }
      }}
      {...props}
    />
  )

  if (!scrollable) return control

  return (
    <ScrollArea
      type="auto"
      scrollbars="x"
      style={{ maxWidth: LABEL_LIST_MAX_WIDTH }}
      data-testid="label-scroll-area"
    >
      {control}
    </ScrollArea>
  )
}

type SelectedLabelControlProps = {
  labels: ILabel[]
  selectedLabelId: string
  onChange: (labelId: string) => void
}

const SelectedLabelControl = ({ labels, selectedLabelId, onChange }: SelectedLabelControlProps) => (
  <TextSegmentedControl
    scrollable
    value={selectedLabelId}
    onChange={onChange}
    data={labels.map((c) => ({
      value: c.id,
      label: c.name
    }))}
  />
)

type LabelingCompletedControlProps = {
  value: string | null
  onChange: (newValue: string | null) => Promise<unknown>
}

const SampleCompletedControl = ({ value, onChange }: LabelingCompletedControlProps) => {
  const isCompleted = value !== null
  return (
    <AsyncButton
      variant="outline"
      onClick={() => onChange(isCompleted ? null : new Date().toISOString())}
    >
      {isCompleted ? 'Mark In Progress' : 'Mark Complete'}
    </AsyncButton>
  )
}

type SampleSelectProps = {
  value: number
  maxIndex: number
  onChange: (newValue: number) => void
}

const SampleSelect = ({ value, maxIndex, onChange }: SampleSelectProps) => (
  <Flex>
    <NumberInput
      aria-label="Sample index"
      styles={{
        root: {
          width: '104px'
        },
        wrapper: {
          height: '100%'
        },
        input: {
          height: '100%'
        }
      }}
      value={value}
      onChange={(e) => {
        onChange(mod(typeof e === 'string' ? parseInt(e) : e, maxIndex + 1))
      }}
      allowDecimal={false}
    />
  </Flex>
)

export type LabelPageProps = {
  project: IProject
  task: ITask
  samples: OptimisticSample[]
  initial: number
}

export const LabelPage = ({ project, samples, initial }: LabelPageProps) => {
  const [index, setIndex] = useState(initial)
  const [isAnnotationsDrawerOpen, setIsAnnotationsDrawerOpen] = useState(false)
  const { store } = useLabeler(project.labels)
  const mode = store((s) => s.mode)
  const selecteLabelId = store((s) => s.selectedLabelId)
  const currentSampleId = store((s) => s.sample?.resolve().id ?? null)
  const sampleCompletedAt = store((s) => s.sample?.resolve().completedAt ?? null)
  const onSampleCompletedChanged = useCallback(
    (sampleId: string, newValue: string | null) => {
      const sample = samples.find((c) => c.resolve().id === sampleId)
      if (sample === undefined) return Promise.resolve()
      const { commit, rollback } = sample.update({
        completedAt: newValue
      })
      // sample.update() mutates the OptimisticObject through its own private
      // subscription system, which the labeler zustand store never hears about.
      // Force a notify so selectors reading sample.resolve() (currentSampleId,
      // sampleCompletedAt) actually re-render.
      store.setState((s) => ({ ...s }))
      return useAppStore
        .getState()
        .store.updateSamples([
          {
            id: sampleId,
            completedAt: newValue
          }
        ])
        .then(() => {
          commit()
          store.setState((s) => ({ ...s }))
        })
        .catch(() => {
          rollback()
          store.setState((s) => ({ ...s }))
        })
    },
    [samples, store]
  )

  useLayoutEffect(() => {
    store.getState().setSample(samples[index])
  }, [index, samples, store])

  // Force a full repaint on return: the canvas's own resize-detection normally covers
  // becoming visible again, but that depends on measuring a bounding rect that Activity
  // may not have finished restoring yet - an explicit markAllDirty() here is reliable.
  useOnRouteEnter(() => store.getState().markAllDirty())
  // Don't let a bitmap load started for this page keep running (and settling into a
  // hidden store) after the user has already left it.
  useOnRouteLeave(() => store.getState().cancelPendingSampleLoad())

  // useHotkeys ignores INPUT/TEXTAREA/SELECT targets by default, so this doesn't fire
  // while e.g. the sample index NumberInput below is focused.
  useHotkeys([
    ['mod+z', () => store.getState().undo()],
    ['mod+shift+z', () => store.getState().redo()],
    ['mod+d', () => store.getState().duplicateSelectedAnnotation()]
  ])

  return (
    <Container>
      <StyledLabeler store={store} />
      <Button
        leftSection={<IoMdArrowBack />}
        variant="outline"
        style={{ position: 'absolute', top: 20, left: 20 }}
        onClick={() => back()}
      >
        Back
      </Button>
      <Button
        leftSection={<MdFormatListBulleted />}
        variant="outline"
        style={{ position: 'absolute', top: 20, right: 20 }}
        onClick={() => setIsAnnotationsDrawerOpen(true)}
      >
        Annotations
      </Button>
      <AnnotationsDrawer
        store={store}
        opened={isAnnotationsDrawerOpen}
        onClose={() => setIsAnnotationsDrawerOpen(false)}
      />
      <Flex style={{ position: 'absolute', bottom: 20, left: 20 }} gap={'md'}>
        <LabelerModeControl value={mode} onChange={(e) => store.getState().setMode(e)} />

        {currentSampleId && (
          <SampleCompletedControl
            value={sampleCompletedAt}
            onChange={(newCompletedAt) => onSampleCompletedChanged(currentSampleId, newCompletedAt)}
          />
        )}
        <SampleSelect value={index} onChange={setIndex} maxIndex={samples.length - 1} />
        {project.labels.length > 1 && (
          <Tooltip label="Select Label">
            <SelectedLabelControl
              selectedLabelId={selecteLabelId}
              labels={project.labels}
              onChange={(e) => store.getState().setLabelId(e)}
            />
          </Tooltip>
        )}
      </Flex>
    </Container>
  )
}
