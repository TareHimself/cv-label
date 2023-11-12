import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import { onImageLoaded, setLabelerRect, setScrollDelta } from "@redux/exports";
import useMouseUp from "@hooks/useMouseUp";
import useElementRect from "@hooks/useElementRect";
import { CvAnnotation } from "@types";
import Canvas from "@frontend/canvas";
import LabelerController from "./LabelerController";

export type BoxContainerProps = {
  tempLabels?: CvAnnotation[];
  onTempLabelUpdated?: (update: CvAnnotation, idx: number) => void;
};

export default function BoxContainer(props: BoxContainerProps) {
  const dispatch = useAppDispatch();

  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const currentSampleId = useAppSelector(
    (s) => s.editor.sampleIds[s.editor.sampleIndex]
  );

  const currentSample = useAppSelector(
    (s) => s.editor.samples[currentSampleId]
  );

  const isLoadingSample = useAppSelector(
    (s) => s.editor.isLoadingCurrentSample
  );

  const projectId = useAppSelector((s) => s.projects.projectId);

  const imageId = useId();

  const labelerRect = useAppSelector((s) => s.editor.labelerRect);

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

  if (!currentSampleIsValid) {
    return <></>;
  }

  return (
    <div
      id={"label-box"}
      onMouseDown={() => {
        setIsDraggingImage(true);
      }}
      // onMouseUp={() => {
      //   setIsDraggi ave={() => {
      //   setIsDraggingImage(false);
      // }}
      style={{}}
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
