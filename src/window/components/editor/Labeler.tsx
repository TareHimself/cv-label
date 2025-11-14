import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import useMouseUp from "@hooks/useMouseUp";
import useElementRect from "@hooks/useElementRect";
import { EEditorMode, IDatabasePoint } from "@types";
import Canvas from "@window/canvas";
import LabelerController from "./controllers/LabelerController";
import AnnotationDrawerController from "./controllers/AnnotationDrawerController";
import 'react-contexify/ReactContexify.css';
import { useEditorState } from "@hooks/useEditorState";

interface IAnnotationContextMenuParams {
  id: string
}

interface IContextMenuProps {
  event: MouseEvent
  annotationId: string
}
export default function Labeler() {

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const currentSampleId = useEditorState((s) => s.sampleIds[s.selectedSampleIndex])
  const currentSample = useEditorState((s) => s.samples.get(s.sampleIds[s.selectedSampleIndex]))
  const isLoadingSample = useEditorState((s) => s.isLoadingSample)
  const imageId = useId()
  const editorMode = useEditorState((s) => s.mode)
  const labelerRect = useEditorState((s) => s.labelerRect)
  const projectId = useEditorState((s) => s.project?.info.id)
  const pointsBeingDrawn = useRef<IDatabasePoint[]>([])
  const onPan = useEditorState((s) => s.onPan)
  const setLabelerRect = useEditorState((s) => s.setLabelerRect)
  const onImageLoaded = useEditorState((s) => s.onImageLoaded)

  useEffect(() => {
    if (isDraggingImage) {
      const onMouseMoved = (e: MouseEvent) => {
        onPan(e.movementX, e.movementY)
      };

      window.addEventListener("mousemove", onMouseMoved);

      return () => {
        window.removeEventListener("mousemove", onMouseMoved);
      };
    }
  }, [isDraggingImage, onPan]);

  useMouseUp(
    useCallback(() => {
      if (isDraggingImage) {
        setIsDraggingImage(false);
      }
    }, [isDraggingImage])
  );

  useElementRect(
    useCallback(
      () =>
        document.getElementById(imageId),
      [imageId]
    ),
    useCallback(
      (rect) => {
        setLabelerRect(rect);
      },
      [setLabelerRect]
    )
  );

  const canvasController = useMemo(
    () =>
      new LabelerController(),
    [labelerRect.height, labelerRect.width]
  );

  const annotationDrawerController = useMemo(
    () =>
      {

        
        if(editorMode === EEditorMode.CREATE_BOX || editorMode === EEditorMode.CREATE_SEGMENT){
          
          return new AnnotationDrawerController({
            drawMode : editorMode,
            renderHeight: labelerRect.height,
            renderWidth: labelerRect.width,
            initialPoints: pointsBeingDrawn.current
          })          
        }

        return undefined;
      },
    [editorMode, labelerRect.height, labelerRect.width]
  );

  // Reset points when we change modes
  useEffect(()=>{
    pointsBeingDrawn.current = []
  },[editorMode])
  

  if (projectId == undefined || currentSample == undefined) {
    return <></>;
  }

  return (
    <div
      id={"label-box"}
      onMouseDown={() => {
        if(editorMode === EEditorMode.SELECT){
          setIsDraggingImage(true);
        }
      }}
      // onMouseUp={() => {
      //   setIsDraggi ave={() => {
      //   setIsDraggingImage(false);
      // }}
    >
      <img
        src={`app://projects/${projectId}/images/${encodeURIComponent(currentSample.imageId)}`}
        alt="img"
        onLoad={(e) => {
          onImageLoaded(e.currentTarget);
        }}
        id={imageId}
        // style={{
        //   maxHeight: `${labelerRect.height}px`,
        // }}
      />
      <Canvas<CanvasRenderingContext2D>
        width={labelerRect.width}
        height={labelerRect.height}
        controller={canvasController}
        style={{
          position: "absolute",
        }}
      />

      {annotationDrawerController && <Canvas<CanvasRenderingContext2D>
        width={labelerRect.width}
        height={labelerRect.height}
        controller={annotationDrawerController}
        style={{
          position: "absolute",
        }}
      />}

      {/* {!isLoadingSample && props.tempLabels?.length && (
        <LabelOverlay
          labels={props.tempLabels}
          onLabelUpdated={(idx, u) => {
            if (props.onTempLabelUpdated) {
              props.onTempLabelUpdated(u, idx);
            }
          }}
        />
      )} */}
    </div>
  );
}
