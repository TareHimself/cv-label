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
import { FaUndoAlt, FaRedoAlt, FaFileImport } from "react-icons/fa";
import Labeler from "./Labeler";
import Icon from "../Icon";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import {
  autoLabel,
  fetchSample,
  importSamples,
  loadAllSamples,
  loadModel,
  setCurrentSample,
  setEditorMode,
  setEditorRect,
  setLabelerContainerRect,
  setSampleScale,
  unloadModel,
} from "@redux/exports";
import { EEditorMode } from "@types";
import useElementRect from "@hooks/useElementRect";
import Crosshair from "./Crosshair";
import SidePanel from "./SidePanel";
import { closeDialog, createDialog } from "@frontend/dialog";
import DialogBox from "@components/DialogBox";
import PluginSelectionList from "./PluginSelectionList";

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

  const currentSample = useAppSelector((s) => s.app.samples[currentSampleId]);

  const isLoadingLabeler = useAppSelector((s) => s.app.isLoadingLabeler);

  const editorMode = useAppSelector((s) => s.app.mode);

  const [lastIndexLabeled, setLastIndexLabeled] = useState(-1);

  const importers = useAppSelector((s) => s.app.availableImporters);

  const models = useAppSelector((s) => s.app.availableModels);

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
  //   dispatch(
  //     importSamples({
  //       id: "files",
  //     })
  //   );
  // }, [dispatch]);

  useEffect(() => {
    if (
      labeler !== undefined &&
      currentSample &&
      lastIndexLabeled !== currentSampleIndex &&
      currentSample.annotations.length === 0
    ) {
      console.log("Labeling", currentSample);
      dispatch(
        autoLabel({
          samplePath: currentSample.id,
        })
      );
      setLastIndexLabeled(currentSampleIndex);
    }
  }, [currentSample, currentSampleIndex, dispatch, lastIndexLabeled, labeler]);

  // useEffect(() => {
  //   if (currentSample && currentSample.labels.length === 0) {
  //     labeler.loadModel("./yolo-seg.onnx").then(() => {
  //       labeler.predict(currentSample.path).then((a) => {
  //         if (a !== undefined) {
  //           dispatch(addLabels(a));
  //         }
  //       });
  //     });
  //   }
  // }, [currentSample, dispatch, labeler]);

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
      {editorMode === EEditorMode.SELECT && (
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
          />
          <Icon
            icon={MdOutlineNavigateBefore}
            onClicked={() => {
              dispatch(setCurrentSample(currentSampleIndex - 1));
            }}
          />
          <Icon
            icon={MdOutlineNavigateNext}
            onClicked={() => {
              dispatch(setCurrentSample(currentSampleIndex + 1));
            }}
          />
          <Icon
            icon={AiOutlineZoomOut}
            onClicked={() => {
              dispatch(setSampleScale(sampleScale - 0.1));
            }}
          />
        </EditorActionPanel>
        <EditorActionPanel position="right">
          <Icon
            icon={PiHandPalmBold}
            isActive={editorMode === EEditorMode.SELECT}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.SELECT));
            }}
          />
          <Icon
            icon={BsBoundingBoxCircles}
            isActive={editorMode === EEditorMode.CREATE_BOX}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.CREATE_BOX));
            }}
          />
          <Icon
            icon={PiPolygonLight}
            isActive={editorMode === EEditorMode.CREATE_SEGMENT}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.CREATE_SEGMENT));
            }}
          />
          <Icon
            icon={MdAutoAwesome}
            isActive={labeler !== undefined || isLoadingLabeler}
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

                // dispatch(
                //   loadModel({
                //     modelPath: "./seg.torchscript",
                //   })
                // );
              } else {
                dispatch(unloadModel());
              }
            }, [dispatch, labeler, models])}
          />
        </EditorActionPanel>
        <EditorActionPanel position="left">
          <Icon icon={BsFiles} />
          <Icon icon={MdLabel} />
          <Icon
            icon={FaFileImport}
            onClicked={() => {
              console.log(
                "Using importer",
                importers.find((d) => d.displayName === "Files")
              );
              dispatch(
                importSamples({
                  id:
                    importers.find((d) => d.displayName === "Files")?.id ?? "",
                })
              );
            }}
          />
          <Icon icon={FaUndoAlt} />
          <Icon icon={FaRedoAlt} />
        </EditorActionPanel>
        {/* <SidePanel name={"Samples"} isOpen={false}>
          <div style={{ width: "18vw", height: "100%", minWidth: 250 }}></div>
        </SidePanel> */}
      </div>
    </div>
  );
}
