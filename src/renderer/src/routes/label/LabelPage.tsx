import { styled } from '@linaria/react'
import {
  Flex,
  MantineSize,
  NumberInput,
  SegmentedControl,
  SegmentedControlProps,
  Tooltip
} from '@mantine/core'
import { Labeler } from '@renderer/components/Labeler'
import { useLabeler } from '@renderer/hooks/useLabeler'
import { useLabelNavState } from '@renderer/navigation'
import { LabelerMode } from '@renderer/types'
import { useCallback, useLayoutEffect, useState } from 'react'
import { PiHandPalmBold, PiPolygonLight } from 'react-icons/pi'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { ILabel, OmitV2 } from '@shared/types'
import { mod } from '@shared/utils'
import { useAppStore } from '@renderer/hooks/useAppStore'

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

// type IconProps = {
//   icon: IconType
//   iconSize?: number
//   disabled?: boolean
//   style?: React.CSSProperties
//   isActive?: boolean
//   onClicked?: () => void
//   tooltip?: string
// }
// export default function Icon({
//   icon,
//   onClicked,
//   iconSize,
//   disabled,
//   style,
//   isActive,
//   tooltip
// }: IconProps) {
//   const IconComponent = icon
//   const size = iconSize ?? 20

//   return (
//     <Tooltip label="Tooltip">
//       <Button disabled={disabled} variant='filled'>
//         <IconComponent size={size} />
//       </Button>
//     </Tooltip>
//     // <>
//     // <button
//     //   data-tooltip-id={iconId}
//     //   onClick={onClicked}
//     //   className={isActive ? "active-icon" : ""}
//     //   style={style}
//     //   disabled={disabled}
//     //   data-tooltip-content={tooltip ?? "Someone forgot to add this tooltip"}
//     // >

//     // </button>
//     // <Tooltip id={iconId} />
//     // </>
//   )
// }

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
            <PiHandPalmBold size={ICON_SIZE} style={ICON_STYLE} />
          </Tooltip>
        )
      },
      {
        value: LabelerMode.CreateBox,
        label: (
          <Tooltip label="Create Boxes">
            <BsBoundingBoxCircles size={ICON_SIZE} style={ICON_STYLE} />
          </Tooltip>
        )
      },
      {
        value: LabelerMode.CreateMask,
        label: (
          <Tooltip label="Create Segments">
            <PiPolygonLight size={ICON_SIZE} style={ICON_STYLE} />
          </Tooltip>
        )
      }
    ]}
  />
)

const TextSegmentedControl = (props: OmitV2<SegmentedControlProps, 'styles'>) => {
  return (
    <SegmentedControl
      size="sm"
      styles={{
        label: {
          display: 'flex',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center'
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
}

type SelectedLabelControlProps = {
  labels: ILabel[]
  selectedLabelId: string
  onChange: (labelId: string) => void
}

const SelectedLabelControl = ({ labels, selectedLabelId, onChange }: SelectedLabelControlProps) => (
  <TextSegmentedControl
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
  onChange: (newValue: string | null) => void
}

const SAMPLE_COMPLETED_CONTROL_IN_PROGRESS = 'in-progress'
const SAMPLE_COMPLETED_CONTROL_COMPLETED = 'completed'

const SampleCompletedControl = ({ value, onChange }: LabelingCompletedControlProps) => (
  <TextSegmentedControl
    value={
      value === null ? SAMPLE_COMPLETED_CONTROL_IN_PROGRESS : SAMPLE_COMPLETED_CONTROL_COMPLETED
    }
    onChange={(e) => {
      switch (e) {
        case SAMPLE_COMPLETED_CONTROL_COMPLETED:
          onChange(new Date().toISOString())
          break
        case SAMPLE_COMPLETED_CONTROL_IN_PROGRESS:
          onChange(null)
          break
      }
    }}
    data={[
      {
        value: SAMPLE_COMPLETED_CONTROL_IN_PROGRESS,
        label: 'In Progress'
      },
      {
        value: SAMPLE_COMPLETED_CONTROL_COMPLETED,
        label: 'Completed'
      }
    ]}
  />
)

type SampleSelectProps = {
  value: number
  maxIndex: number
  onChange: (newValue: number) => void
}

const SampleSelect = ({ value, maxIndex, onChange }: SampleSelectProps) => (
  <Flex>
    <NumberInput
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

export const LabelPage = () => {
  const { project, samples, initial } = useLabelNavState()

  const [index, setIndex] = useState(initial)
  const { store } = useLabeler(project.labels)
  const mode = store((s) => s.mode)
  const selecteLabelId = store((s) => s.selectedLabelId)
  const currentSampleId = store((s) => s.sample?.resolve().id ?? null)
  const sampleCompletedAt = store((s) => s.sample?.resolve().completedAt ?? null)
  const onSampleCompletedChanged = useCallback(
    (sampleId: string, newValue: string | null) => {
      const sample = samples.find((c) => c.resolve().id === sampleId)
      if (sample === undefined) return
      const { commit, rollback } = sample.update({
        completedAt: newValue
      })
      useAppStore
        .getState()
        .store.updateSamples([
          {
            id: sampleId,
            completedAt: newValue
          }
        ])
        .then(() => {
          commit()
        })
        .catch(() => {
          rollback()
        })
    },
    [samples]
  )

  useLayoutEffect(() => {
    store.getState().setSample(samples[index])
  }, [index, samples, store])

  return (
    <Container>
      <StyledLabeler store={store} />
      <Flex
        style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translate(-50%,0)' }}
        gap={'md'}
      >
        <LabelerModeControl value={mode} onChange={(e) => store.getState().setMode(e)} />

        {project.labels.length > 1 && (
          <Tooltip label="Select Label">
            <SelectedLabelControl
              selectedLabelId={selecteLabelId}
              labels={project.labels}
              onChange={(e) => store.getState().setLabelId(e)}
            />
          </Tooltip>
        )}
        {currentSampleId && (
          <SampleCompletedControl
            value={sampleCompletedAt}
            onChange={(newCompletedAt) => onSampleCompletedChanged(currentSampleId, newCompletedAt)}
          />
        )}
        <SampleSelect value={index} onChange={setIndex} maxIndex={samples.length - 1} />

        {/* <Icon
            icon={MdAutoAwesome}
            isActive={labeler !== undefined || isLoadingLabeler}
            tooltip="Auto Label"
            onClicked={useCallback(() => {
              if (labeler === undefined) {
                createDialog((p) => (
                  <DialogBox
                    onCloseRequest={() => {
                      closeDialog(p.id);
                    }}
                  >
                    <PluginSelectionList
                      plugins={models}
                      onPluginSelected={(plugin) => {
                        dispatch(
                          loadModel({
                            modelId: plugin.id,
                          })
                        );
                        closeDialog(p.id);
                      }}
                    />
                  </DialogBox>
                ));
              } else {
                dispatch(unloadModel());
              }
            }, [dispatch, labeler, models])}
          /> */}
        {/* <Icon
          icon={BsFiles}
          tooltip="Samples"
          onClicked={() => {
            setSidePanel('samples')
          }}
        />
        <Icon icon={MdLabel} tooltip="Annotations" />
        <ImportSamplesIcon />
        <ExportSamplesIcon />
        <Icon
          icon={AiOutlineZoomIn}
          onClicked={() => {
            setScale(sampleScale + 0.1)
          }}
          tooltip="Zoom In"
        />
        <Icon
          icon={AiOutlineZoomOut}
          onClicked={() => {
            setScale(sampleScale - 0.1)
          }}
          tooltip="Zoom Out"
        />
        <Icon
          icon={MdOutlineNavigateBefore}
          onClicked={() => {
            setCurrentSampleIndex(currentSampleIndex - 1)
          }}
          tooltip="Previous Sample"
        />
        <Icon
          icon={MdOutlineNavigateNext}
          onClicked={() => {
            setCurrentSampleIndex(currentSampleIndex + 1)
          }}
          tooltip="Next Sample"
        /> */}
      </Flex>
    </Container>
  )
}
