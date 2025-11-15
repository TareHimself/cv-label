import { useCallback, useEffect, useRef, useState } from "react";
import EditorActionPanel from "./EditorActionPanel";
import { AiOutlineZoomIn, AiOutlineZoomOut } from "react-icons/ai";
import { BsBoundingBoxCircles, BsFiles } from "react-icons/bs";
import { PiPolygonLight, PiHandPalmBold } from "react-icons/pi";
import {
  MdOutlineNavigateNext,
  MdOutlineNavigateBefore,
  MdLabel,
} from "react-icons/md";
import Labeler from "./Labeler";
import Icon from "../Icon";
import { EEditorMode, IPluginInfo } from "@types";
import useElementRect from "@hooks/useElementRect";
import Crosshair from "./Crosshair";
import SidePanel from "./SidePanel";
import { useEditorState } from "@hooks/useEditorState";
import { ImportSamplesIcon } from "./ImportSamplesIcon";
import { ExportSamplesIcon } from "./ExportSamplesIcon";

export default function Editor() {
  const sampleScale = useEditorState((s) => s.scale);
  const editorRect = useEditorState((s) => s.editorRect);
  const panX = useEditorState((s) => s.panX);
  const panY = useEditorState((s) => s.panY);

  const labelerContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const currentSampleIndex = useEditorState((s) => s.selectedSampleIndex);

  const currentSampleId = useEditorState(
    (s) => s.sampleIds[s.selectedSampleIndex]
  );

  const currentSample = useEditorState((s) => s.samples.get(currentSampleId));

  const editorMode = useEditorState((s) => s.mode);

  const importers = [] as IPluginInfo[];

  const exporters = [] as IPluginInfo[];

  const models = [] as IPluginInfo[];

  const samplesPendingAutoLabel = [] as string[];

  const [lastAutoId, setLastAutoId] = useState("");

  const setEditorRect = useEditorState((s) => s.setEditorRect);
  const loadSample = useEditorState((s) => s.loadSample);
  const setEditorMode = useEditorState((s) => s.setEditorMode);
  const setSidePanel = useEditorState((s) => s.setSidePanel);
  const setScale = useEditorState((s) => s.setScale);
  const setCurrentSampleIndex = useEditorState((s) => s.setSelectedSampleIndex);
  useElementRect(
    useCallback(() => editorRef.current, []),
    useCallback(
      (rect) => {
        setEditorRect(rect);
      },
      [setEditorRect]
    )
  );

  useEffect(() => {
    if (currentSample === undefined) {
      loadSample(currentSampleId);
    }
  }, [currentSample, currentSampleId, loadSample]);

  // useEffect(() => {
  //   dispatch(loadAllSamples());
  // }, [dispatch]);

  // useEffect(() => {
  //   dispatch(f
  //     importSamples({
  //       id: "files",
  //     })
  //   );
  // }, [dispatch]);

  // useEffect(() => {
  //   if (
  //     labeler !== undefined &&
  //     currentSample !== undefined &&
  //     currentSample.id !== lastAutoId &&
  //     currentSample.annotations.length === 0 &&
  //     !samplesPendingAutoLabel.includes(currentSample.id)
  //   ) {
  //     console.log("Labeling", currentSample.id);
  //     setLastAutoId(currentSample.id);
  //     dispatch(
  //       autoLabel({
  //         sampleId: currentSample.id,
  //       })
  //     );
  //   }
  // }, [
  //   currentSample,
  //   currentSampleIndex,
  //   dispatch,
  //   labeler,
  //   lastAutoId,
  //   samplesPendingAutoLabel,
  // ]);
  return (
    <div id={"editor"} ref={(r) => (editorRef.current = r)}>
      <div
        className="editor-layer"
        style={{
          backgroundColor: "rgb(69, 67, 67)",
        }}
      >
        <div
          ref={(r) => (labelerContainerRef.current = r)}
          style={{
            display: "flex",
            boxSizing: "border-box",
            padding: "70px",
            justifyContent: "center",
            backgroundColor: "#454343",
            position: "absolute",
            width: `${sampleScale * editorRect.width}px`,
            height: `${sampleScale * editorRect.height}px`,
            alignItems: "center",
            transform: `translate(${panX}px,${panY}px)`,
          }}
        >
          <Labeler />
        </div>
      </div>
      {editorMode !== EEditorMode.SELECT && (
        <div className="editor-layer">
          <Crosshair />
        </div>
      )}
      <div className="editor-layer">
        <EditorActionPanel position="bottom">
          <Icon
            icon={PiHandPalmBold}
            isActive={editorMode === EEditorMode.SELECT}
            onClicked={() => {
              setEditorMode(EEditorMode.SELECT);
            }}
            tooltip="Select"
          />
          <Icon
            icon={BsBoundingBoxCircles}
            isActive={editorMode === EEditorMode.CREATE_BOX}
            onClicked={() => {
              setEditorMode(EEditorMode.CREATE_BOX);
            }}
            tooltip="Create Boxes"
          />
          <Icon
            icon={PiPolygonLight}
            isActive={editorMode === EEditorMode.CREATE_SEGMENT}
            onClicked={() => {
              setEditorMode(EEditorMode.CREATE_SEGMENT);
            }}
            tooltip="Create Segments"
          />
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
          <Icon
            icon={BsFiles}
            tooltip="Samples"
            onClicked={() => {
              setSidePanel("samples");
            }}
          />
          <Icon icon={MdLabel} tooltip="Annotations" />
          <ImportSamplesIcon />
          <ExportSamplesIcon />
          <Icon
            icon={AiOutlineZoomIn}
            onClicked={() => {
              setScale(sampleScale + 0.1);
            }}
            tooltip="Zoom In"
          />
          <Icon
            icon={AiOutlineZoomOut}
            onClicked={() => {
              setScale(sampleScale - 0.1);
            }}
            tooltip="Zoom Out"
          />
          <Icon
            icon={MdOutlineNavigateBefore}
            onClicked={() => {
              setCurrentSampleIndex(currentSampleIndex - 1);
            }}
            tooltip="Previous Sample"
          />
          <Icon
            icon={MdOutlineNavigateNext}
            onClicked={() => {
              setCurrentSampleIndex(currentSampleIndex + 1);
            }}
            tooltip="Next Sample"
          />
        </EditorActionPanel>
        <SidePanel name={"Samples"} id="samples">
          <div style={{ width: "18vw", height: "100%", minWidth: 250 }}></div>
        </SidePanel>
      </div>
    </div>
  );
}
