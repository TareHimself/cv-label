import { styled } from '@linaria/react'
import { Flex, NumberInput, SegmentedControl, Tooltip } from '@mantine/core'
import { Labeler } from '@renderer/components/Labeler'
import { useLabeler } from '@renderer/hooks/useLabeler'
import { useLabelNavState } from '@renderer/navigation'
import { IOptimisticSample, LabelerMode } from '@renderer/types'
import { useLayoutEffect, useMemo, useState } from 'react'
import { PiHandPalmBold, PiPolygonLight } from 'react-icons/pi'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { OptimisticObject } from '@renderer/optimistic'
import { IAnnotation, ILabel } from '@shared/types'
import { mod } from '@shared/utils'

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

type ModeSelectProps = {
  value: LabelerMode
  onChange: (newValue: LabelerMode) => void
}
const ModeSelect = ({ value, onChange }: ModeSelectProps) => (
  <SegmentedControl
    size="md"
    value={value}
    onChange={(newMode) => {
      onChange(newMode as LabelerMode)
    }}
    styles={{
      label: {
        display: 'flex',
        width: '50px',
        height: '50px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0
      },
      innerLabel: {
        display: 'flex'
      }
    }}
    data={[
      {
        value: LabelerMode.Select,
        label: (
          <Tooltip label="Select">
            <PiHandPalmBold size={20} />
          </Tooltip>
        )
      },
      {
        value: LabelerMode.CreateBox,
        label: (
          <Tooltip label="Create Boxes">
            <BsBoundingBoxCircles size={20} />
          </Tooltip>
        )
      },
      {
        value: LabelerMode.CreateMask,
        label: (
          <Tooltip label="Create Segments">
            <PiPolygonLight size={20} />
          </Tooltip>
        )
      }
    ]}
  />
)

type LabelSelectProps = {
  labels: ILabel[]
  selectedLabelId: string
  onChange: (labelId: string) => void
}

const LabelSelect = ({ labels, selectedLabelId, onChange }: LabelSelectProps) => (
  <SegmentedControl
    size="md"
    value={selectedLabelId}
    onChange={onChange}
    styles={{
      label: {
        display: 'flex',
        width: '100%',
        height: '50px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10
      },
      innerLabel: {
        display: 'flex'
      }
    }}
    data={labels.map((c) => ({
      value: c.id,
      label: c.name
    }))}
  />

  // [
  //     {
  //       value: LabelerMode.Select,
  //       label: (
  //         <Tooltip label="Select">
  //           <PiHandPalmBold size={20} />
  //         </Tooltip>
  //       )
  //     },
  //     {
  //       value: LabelerMode.CreateBox,
  //       label: (
  //         <Tooltip label="Create Boxes">
  //           <BsBoundingBoxCircles size={20} />
  //         </Tooltip>
  //       )
  //     },
  //     {
  //       value: LabelerMode.CreateMask,
  //       label: (
  //         <Tooltip label="Create Segments">
  //           <PiPolygonLight size={20} />
  //         </Tooltip>
  //       )
  //     }
  //   ]
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
  const optimisticSamples = useMemo<IOptimisticSample[]>(() => {
    return samples.map((c) => {
      const annotationsObj = c.annotations.reduce<{ [key: string]: OptimisticObject<IAnnotation> }>(
        (t, c) => {
          return { ...t, [c.id]: new OptimisticObject(c) }
        },
        {}
      )

      return new OptimisticObject({ ...c, annotations: new OptimisticObject(annotationsObj, true) })
    })
  }, [samples])

  const [index, setIndex] = useState(initial)
  const { store } = useLabeler(project.labels)
  const mode = store((s) => s.mode)
  const selecteLabelId = store((s) => s.selectedLabelId)

  useLayoutEffect(() => {
    store.getState().setSample(optimisticSamples[index])
  }, [index, optimisticSamples, samples, store])

  return (
    <Container>
      <StyledLabeler store={store} />
      <Flex
        style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translate(-50%,0)' }}
        gap={'md'}
      >
        <ModeSelect value={mode} onChange={(e) => store.getState().setMode(e)} />
        {project.labels.length > 1 && (
          <Tooltip label="Select Label">
            <LabelSelect
              selectedLabelId={selecteLabelId}
              labels={project.labels}
              onChange={(e) => store.getState().setLabelId(e)}
            />
          </Tooltip>
        )}
        <SampleSelect value={index} onChange={setIndex} maxIndex={optimisticSamples.length - 1} />
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
