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
import BoxContainer from "./BoxContainer";
import ActionPanelIcon from "./ActionPanelIcon";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import {
  autoLabel,
  importSamples,
  loadModel,
  setCurrentSample,
  setEditorMode,
  setEditorRect,
  setLabelerContainerRect,
  setSampleScale,
  unloadModel,
} from "@redux/exports";
import { ECVModelType, EEditorMode } from "@types";
import useElementRect from "@hooks/useElementRect";
import Crosshair from "./Crosshair";

export default function Editor() {
  const labeler = useAppSelector((s) => s.editor.activeLabeler);

  const dispatch = useAppDispatch();

  const sampleScale = useAppSelector((s) => s.editor.sampleScale);

  const editorRect = useAppSelector((s) => s.editor.editorRect);

  const scrollX = useAppSelector((s) => s.editor.xScroll);

  const scrollY = useAppSelector((s) => s.editor.yScroll);

  const labelerContainerRef = useRef<HTMLDivElement | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const currentSample = useAppSelector(
    (s) => s.editor.samples[s.editor.sampleList[s.editor.sampleIndex]]
  );

  const editorMode = useAppSelector((s) => s.editor.mode);

  const currentSampleIndex = useAppSelector((s) => s.editor.sampleIndex);

  const [lastIndexLabeled, setLastIndexLabeled] = useState(-1);

  const importers = useAppSelector((s) => s.editor.availableImporters);

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

  // useEffect(() => {
  //   dispatch(
  //     importSamples({
  //       id: "files",
  //     })
  //   );
  // }, [dispatch]);

  useEffect(() => {
    if (
      labeler &&
      currentSample &&
      lastIndexLabeled !== currentSampleIndex &&
      currentSample.labels.length === 0
    ) {
      dispatch(
        autoLabel({
          index: currentSampleIndex,
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
          <BoxContainer />
        </div>
      </div>
      {editorMode === EEditorMode.SELECT && (
        <div className="editor-layer">
          <Crosshair />
        </div>
      )}
      <div className="editor-layer">
        <EditorActionPanel position="bottom">
          <ActionPanelIcon
            icon={AiOutlineZoomIn}
            onClicked={() => {
              dispatch(setSampleScale(sampleScale + 0.1));
            }}
          />
          <ActionPanelIcon
            icon={MdOutlineNavigateBefore}
            onClicked={() => {
              dispatch(setCurrentSample(currentSampleIndex - 1));
            }}
          />
          <ActionPanelIcon
            icon={MdOutlineNavigateNext}
            onClicked={() => {
              dispatch(setCurrentSample(currentSampleIndex + 1));
            }}
          />
          <ActionPanelIcon
            icon={AiOutlineZoomOut}
            onClicked={() => {
              dispatch(setSampleScale(sampleScale - 0.1));
            }}
          />
        </EditorActionPanel>
        <EditorActionPanel position="right">
          <ActionPanelIcon
            icon={PiHandPalmBold}
            isActive={editorMode === EEditorMode.SELECT}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.SELECT));
            }}
          />
          <ActionPanelIcon
            icon={BsBoundingBoxCircles}
            isActive={editorMode === EEditorMode.CREATE_BOX}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.CREATE_BOX));
            }}
          />
          <ActionPanelIcon
            icon={PiPolygonLight}
            isActive={editorMode === EEditorMode.CREATE_SEGMENT}
            onClicked={() => {
              dispatch(setEditorMode(EEditorMode.CREATE_SEGMENT));
            }}
          />
          <ActionPanelIcon
            icon={MdAutoAwesome}
            isActive={labeler !== undefined}
            onClicked={useCallback(() => {
              if (!labeler) {
                dispatch(
                  loadModel({
                    modelType: ECVModelType.Yolov8Seg,
                    modelPath: "./yolo-seg.onnx",
                  })
                );
              } else {
                dispatch(unloadModel());
              }
            }, [dispatch, labeler])}
          />
        </EditorActionPanel>
        <EditorActionPanel position="left">
          <ActionPanelIcon icon={BsFiles} />
          <ActionPanelIcon icon={MdLabel} />
          <ActionPanelIcon
            icon={FaFileImport}
            onClicked={() => {
              console.log("Using importer", importers[0]);
              dispatch(
                importSamples({
                  id: importers[0].id,
                })
              );
            }}
          />
          <ActionPanelIcon icon={FaUndoAlt} />
          <ActionPanelIcon icon={FaRedoAlt} />
        </EditorActionPanel>
      </div>
    </div>
  );
}
