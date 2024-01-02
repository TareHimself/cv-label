import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import { onImageLoaded, setLabelerRect, setScrollDelta } from "@redux/exports";
import useMouseUp from "@hooks/useMouseUp";
import useElementRect from "@hooks/useElementRect";
import { EEditorMode, IDatabasePoint } from "@types";
import Canvas from "@frontend/canvas";
import LabelerController from "./controllers/LabelerController";
import AnnotationDrawerController from "./controllers/AnnotationDrawerController";
import { Menu, Item, Separator, Submenu, useContextMenu } from 'react-contexify';
import 'react-contexify/ReactContexify.css';

interface IAnnotationContextMenuParams {
  id: string
}

interface IContextMenuProps {
  event: MouseEvent
  annotationId: string
}
export default function Labeler() {
  const dispatch = useAppDispatch();


  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const currentSampleId = useAppSelector(
    (s) => s.app.sampleIds[s.app.sampleIndex]
  );

  const currentSample = useAppSelector(
    (s) => s.app.loadedSamples[currentSampleId]
  );

  const isLoadingSample = useAppSelector(
    (s) => s.app.isLoadingCurrentSample
  );

  const projectId = useAppSelector((s) => s.app.projectId);

  const imageId = useId();

  const labelerRect = useAppSelector((s) => s.app.labelerRect);

  const editorMode = useAppSelector((s) => s.app.mode);

  const pointsBeingDrawn = useRef<IDatabasePoint[]>([])

  useEffect(() => {
    if (isDraggingImage) {
      const onMouseMoved = (e: MouseEvent) => {
        dispatch(setScrollDelta([e.movementX, e.movementY]));
      };

      window.addEventListener("mousemove", onMouseMoved);

      return () => {
        window.removeEventListener("mousemove", onMouseMoved);
      };
    }
  }, [dispatch, isDraggingImage]);

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
        currentSample === undefined || isLoadingSample
          ? null
          : document.getElementById(imageId),
      [currentSample, imageId, isLoadingSample]
    ),
    useCallback(
      (rect) => {
        dispatch(setLabelerRect(rect));
      },
      [dispatch]
    )
  );

  const currentSampleIsValid = currentSample !== undefined;

  const canvasController = useMemo(
    () =>
      new LabelerController({
        renderHeight: labelerRect.height,
        renderWidth: labelerRect.width,
      }),
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

  if (!currentSampleIsValid) {
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
        src={`app://projects/${projectId}/images/${currentSampleId}`}
        alt="img"
        onLoad={(e) => {
          dispatch(onImageLoaded(e.currentTarget));
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
