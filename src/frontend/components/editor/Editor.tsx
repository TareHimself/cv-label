import { useCallback, useEffect, useRef, useState } from "react";
import EditorActionPanel from "./EditorActionPanel";
import { AiOutlineZoomIn, AiOutlineZoomOut } from "react-icons/ai";
import { BsBoundingBoxCircles, BsFiles } from "react-icons/bs";
import { PiPolygonLight, PiHandPalmBold } from "react-icons/pi";
import {
  MdAutoAwesome,
  MdOutlineNavigateNext,
  MdOutlineNavigateBefore,
  MdLabel,
} from "react-icons/md";
import {
  FaUndoAlt,
  FaRedoAlt,
  FaFileImport,
  FaFileExport,
} from "react-icons/fa";
import Labeler from "./Labeler";
import Icon from "../Icon";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import {
  autoLabel,
  exportSamples,
  fetchSample,
  importSamples,
  loadAllSamples,
  loadModel,
  setCurrentSample,
  setEditorMode,
  setEditorRect,
  setLabelerContainerRect,
  setSampleScale,
  setSidePanel,
  unloadModel,
} from "@redux/exports";
import { EEditorMode } from "@types";
import useElementRect from "@hooks/useElementRect";
import Crosshair from "./Crosshair";
//import SidePanel from "./SidePanel";
import { closeDialog, createDialog } from "@frontend/dialog";
import DialogBox from "@components/DialogBox";
import PluginSelectionList from "./PluginSelectionList";
import SidePanel from "./SidePanel";

export default function Editor() {
  const labeler = useAppSelector((s) => s.app.activeLabeler);

  const dispatch = useAppDispatch();

  const sampleScale = useAppSelector((s) => s.app.sampleScale);

  const editorRect = useAppSelector((s) => s.app.editorRect);

  const scrollX = useAppSelector((s) => s.app.xScroll);

  const scrollY = useAppSelector((s) => s.app.yScroll);

  const labelerContainerRef = useRef<HTMLDivElement | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const currentSampleIndex = useAppSelector((s) => s.app.sampleIndex);

  const currentSampleId = useAppSelector(
    (s) => s.app.sampleIds[s.app.sampleIndex]
  );

  const currentSample = useAppSelector(
    (s) => s.app.loadedSamples[currentSampleId]
  );

  const isLoadingLabeler = useAppSelector((s) => s.app.isLoadingLabeler);

  const editorMode = useAppSelector((s) => s.app.mode);

  const importers = useAppSelector((s) => s.app.availableImporters);

  const exporters = useAppSelector((s) => s.app.availableExporters)

  const models = useAppSelector((s) => s.app.availableModels);

  const samplesPendingAutoLabel = useAppSelector(
    (s) => s.app.samplesPendingAutoLabel
  );

  const [lastAutoId, setLastAutoId] = useState("");

  useElementRect(
    useCallback(() => editorRef.current, []),
    useCallback(
      (rect) => {
        dispatch(setEditorRect(rect));
      },
      [dispatch]
    )
  );

  useElementRect(
    useCallback(() => labelerContainerRef.current, []),
    useCallback(
      (rect) => {
        dispatch(setLabelerContainerRect(rect));
      },
      [dispatch]
    )
  );

  useEffect(() => {
    if (currentSample === undefined) {
      dispatch(
        fetchSample({
          id: currentSampleId,
        })
      );
    }
  }, [currentSample, currentSampleId, dispatch]);

  useEffect(() => {
    dispatch(loadAllSamples());
  }, [dispatch]);

  // useEffect(() => {
  //   dispatch(f
  //     importSamples({
  //       id: "files",
  //     })
  //   );
  // }, [dispatch]);

  useEffect(() => {
    if (
      labeler !== undefined &&
      currentSample !== undefined &&
      currentSample.id !== lastAutoId &&
      currentSample.annotations.length === 0 &&
      !samplesPendingAutoLabel.includes(currentSample.id)
    ) {
      console.log("Labeling", currentSample.id);
      setLastAutoId(currentSample.id);
      dispatch(
        autoLabel({
          sampleId: currentSample.id,
        })
      );
    }
  }, [
    currentSample,
    currentSampleIndex,
    dispatch,
    labeler,
    lastAutoId,
    samplesPendingAutoLabel,
  ]);

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
            transform: `translate(${scrollX}px,${scrollY}px)`,
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
            icon={AiOutlineZoomIn}
            onClicked={() => {
              dispatch(setSampleScale(sampleScale + 0.1));
            }}
            tooltip="Zoom In"
          />
          <Icon
            icon={MdOutlineNavigateBefore}
            onClicked={() => {
              dispatch(setCurrentSample(currentSampleIndex - 1));
            }}
            tooltip="Previous Sample"
          />
          <Icon
            icon={MdOutlineNavigateNext}
            onClicked={() => {
              dispatch(setCurrentSample(currentSampleIndex + 1));
            }}
            tooltip="Next Sample"
          />
          <Icon
            icon={AiOutlineZoomOut}
            onClicked={() => {
              dispatch(setSampleScale(sampleScale - 0.1));
            }}
            tooltip="Zoom Out"
          />
        </EditorActionPanel>
        <EditorActionPanel position="right">
          <Icon
            icon={PiHandPalmBold}
            isActive={editorMode === EEditorMode.SELECT}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.SELECT));
            }}
            tooltip="Select"
          />
          <Icon
            icon={BsBoundingBoxCircles}
            isActive={editorMode === EEditorMode.CREATE_BOX}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.CREATE_BOX));
            }}
            tooltip="Create Boxes"
          />
          <Icon
            icon={PiPolygonLight}
            isActive={editorMode === EEditorMode.CREATE_SEGMENT}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.CREATE_SEGMENT));
            }}
            tooltip="Create Segments"
          />
          <Icon
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
          />
        </EditorActionPanel>
        <EditorActionPanel position="left">
          <Icon
            icon={BsFiles}
            tooltip="Samples"
            onClicked={() => {
              dispatch(setSidePanel("samples"));
            }}
          />
          <Icon icon={MdLabel} tooltip="Annotations" />
          <Icon
            icon={FaFileImport}
            onClicked={() => {
              createDialog((p) => (
                <DialogBox
                  onCloseRequest={() => {
                    closeDialog(p.id);
                  }}
                >
                  <PluginSelectionList
                    plugins={importers}
                    onPluginSelected={(plugin) => {
                      dispatch(
                        importSamples({
                          id: plugin.id,
                        })
                      );
                      closeDialog(p.id);
                    }}
                  />
                </DialogBox>
              ));
            }}
            tooltip="Import Samples"
          />
          <Icon
            icon={FaFileExport}
            tooltip="Export Project"
            onClicked={() => {
              createDialog((p) => (
                <DialogBox
                  onCloseRequest={() => {
                    closeDialog(p.id);
                  }}
                >
                  <PluginSelectionList
                    plugins={exporters}
                    onPluginSelected={(plugin) => {
                      dispatch(
                        exportSamples({
                          id: plugin.id,
                        })
                      );
                      closeDialog(p.id);
                    }}
                  />
                </DialogBox>
              ));
            }}
          />
        </EditorActionPanel>
        <SidePanel name={"Samples"} id="samples">
          <div style={{ width: "18vw", height: "100%", minWidth: 250 }}></div>
        </SidePanel>
      </div>
    </div>
  );
}
