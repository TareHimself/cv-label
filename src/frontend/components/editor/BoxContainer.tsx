import { useCallback, useEffect, useId, useState } from "react";
import LabelOverlay from "./LabelOverlay";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import {
  editLabel,
  onImageLoaded,
  setLabelerRect,
  setScrollDelta,
} from "@redux/exports";
import useMouseUp from "@hooks/useMouseUp";
import useElementRect from "@hooks/useElementRect";
import { CvLabel } from "@types";

export type BoxContainerProps = {
  tempLabels?: CvLabel[];
  onTempLabelUpdated?: (update: CvLabel, idx: number) => void;
};

export default function BoxContainer(props: BoxContainerProps) {
  const dispatch = useAppDispatch();

  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const currentSample = useAppSelector(
    (s) => s.editor.samples[s.editor.sampleList[s.editor.sampleIndex]]
  );

  const isLoadingSample = useAppSelector(
    (s) => s.editor.isLoadingCurrentSample
  );

  const imageId = useId();

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

  if (currentSample === undefined) {
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
        src={`app://file/${currentSample.path}`}
        alt="img"
        onLoad={(e) => {
          dispatch(onImageLoaded(e.currentTarget));
        }}
        id={imageId}
        // style={{
        //   maxHeight: `${labelerRect.height}px`,
        // }}
      />
      {!isLoadingSample && (
        <LabelOverlay
          labels={currentSample.labels}
          onLabelUpdated={(idx, u) => {
            dispatch(editLabel([idx, u]));
          }}
        />
      )}

      {!isLoadingSample && props.tempLabels?.length && (
        <LabelOverlay
          labels={props.tempLabels}
          onLabelUpdated={(idx, u) => {
            if (props.onTempLabelUpdated) {
              props.onTempLabelUpdated(u, idx);
            }
          }}
        />
      )}
    </div>
  );
}
