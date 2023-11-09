import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import { onImageLoaded, setLabelerRect, setScrollDelta } from "@redux/exports";
import useMouseUp from "@hooks/useMouseUp";
import useElementRect from "@hooks/useElementRect";
import { CvAnnotation } from "@types";
import Canvas, {
  ICanvasPrepData,
  ICanvasDrawData,
  CanvasController,
} from "@frontend/canvas";
import { store } from "@redux/store";

interface ILabelerControllerConfig {
  renderWidth: number;
  renderHeight: number;
}
class LabelerController extends CanvasController<CanvasRenderingContext2D> {
  config: ILabelerControllerConfig;
  constructor(config: ILabelerControllerConfig) {
    super();
    this.config = config;
  }

  getState(){
    return store.getState();
  }

  override onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
    data.canvas.width = this.config.renderWidth;
    data.canvas.height = this.config.renderHeight;
  }

  override getContext(
    canvas: HTMLCanvasElement
  ): CanvasRenderingContext2D | null {
    return canvas.getContext("2d");
  }

  override draw(data: ICanvasDrawData<CanvasRenderingContext2D>): void {
    const state = this.getState()

    const currentSample =
      state.editor.samples[state.editor.sampleIds[state.editor.sampleIndex]];

    if (currentSample === undefined) {
      return;
    }

    const { ctx } = data;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const [scaleX, scaleY] = [
      state.editor.labelerRect.width / state.editor.sampleImageInfo.width,
      state.editor.labelerRect.height / state.editor.sampleImageInfo.height,
    ];

    for (const annotation of currentSample.annotations) {
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;

      const firstPoint = annotation.points[0];

      ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);

      for (const point of annotation.points.slice(1)) {
        ctx.lineTo(point.x * scaleX, point.y * scaleY);
      }

      ctx.lineTo(firstPoint.x * scaleX, firstPoint.y * scaleY);

      ctx.stroke();
    }
  }
}

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
