import Polygon from "@components/Polygon";
import { setLabelIndex } from "@redux/exports";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import {
  CvBoxAnnotation,
  CvSegmentAnnotation,
  EEditorMode,
  ELabelType,
  LabelOverlayProps,
} from "@types";
import { useEffect } from "react";

type DrawProps<T> = {
  label: T;
  isEditable: boolean;
  onUpdated: (update: T) => void;
  onClicked?: () => void;
};

function DrawBox({
  label,
  onUpdated,
  isEditable,
  onClicked,
}: DrawProps<CvBoxAnnotation>) {
  const labelerRect = useAppSelector((s) => s.editor.labelerRect);
  const imageInfo = useAppSelector((s) => s.editor.sampleImageInfo);

  const [scaleX, scaleY] = [
    labelerRect.width / imageInfo.width,
    labelerRect.height / imageInfo.height,
  ];

  const [pts1, pts2] = label.points;

  const [x1, y1] = pts1;
  const [x2, y2] = pts2;

  const pointsRaw: [number, number][] = [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];

  const pointsScaled: [number, number][] = pointsRaw.map((b) => [
    b[0] * scaleX,
    b[1] * scaleY,
  ]);

  return (
    <Polygon
      points={pointsScaled}
      onDragCompleted={(newPoints) => {
        onUpdated({
          ...label,
          points: [
            [
              Math.min(...newPoints.map((a) => a[0])) / scaleX,
              Math.min(...newPoints.map((a) => a[1])) / scaleY,
            ],
            [
              Math.max(...newPoints.map((a) => a[0])) / scaleX,
              Math.max(...newPoints.map((a) => a[1])) / scaleY,
            ],
          ],
        });
        return newPoints;
      }}
      isRect={true}
      isEditable={isEditable}
      onClicked={onClicked}
      key={pointsScaled.toString()}
    />
  );
}

function DrawSegment({
  label,
  onUpdated,
  isEditable,
  onClicked,
}: DrawProps<CvSegmentAnnotation>) {
  const labelerRect = useAppSelector((s) => s.editor.labelerRect);
  const imageInfo = useAppSelector((s) => s.editor.sampleImageInfo);

  const [scaleX, scaleY] = [
    labelerRect.width / imageInfo.width,
    labelerRect.height / imageInfo.height,
  ];

  const pointsScaled: [number, number][] = label.points.map((b) => [
    b[0] * scaleX,
    b[1] * scaleY,
  ]);

  return (
    <Polygon
      points={pointsScaled}
      onDragCompleted={(newPoints) => {
        onUpdated({
          ...label,
          points: newPoints.map((b) => [b[0] / scaleX, b[1] / scaleY]),
        });
        return newPoints;
      }}
      isRect={false}
      isEditable={isEditable}
      onClicked={onClicked}
    />
  );
}

export default function LabelOverlay({
  labels,
  onLabelUpdated,
}: LabelOverlayProps) {
  const labelIndex = useAppSelector((s) => s.editor.currentLabelIndex);
  const editorMode = useAppSelector((s) => s.editor.mode);
  const dispatch = useAppDispatch();
  const labelerRect = useAppSelector((s) => s.editor.labelerRect);
  const labelerRectDims = `${labelerRect.height}x${labelerRect.width}`;

  useEffect(() => {
    const labelOverlay = document.getElementById("label-overlay");
    if (labelOverlay) {
      const circleElements = Array.from(
        labelOverlay.querySelectorAll("circle")
      );

      for (const element of circleElements) {
        labelOverlay.removeChild(element);
        labelOverlay.appendChild(element);
      }
    }
  });

  return (
    <svg
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: labelerRect.width,
        height: labelerRect.height,
        transform: "translate(-50%,-50%)",
      }}
      id="label-overlay"
    >
      {labels.map((a, idx) => {
        const canBeEdited =
          editorMode === EEditorMode.SELECT && labelIndex === idx;
        if (a.type === ELabelType.BOX) {
          return (
            <DrawBox
              label={a}
              key={`label-${idx}-${labelerRectDims}`}
              onUpdated={(u) => {
                onLabelUpdated(idx, u);
              }}
              isEditable={canBeEdited}
              onClicked={() => {
                if (!canBeEdited) {
                  dispatch(setLabelIndex(idx));
                }
              }}
            />
          );
        } else {
          return (
            <DrawSegment
              label={a}
              key={`label-${idx}-${labelerRectDims}`}
              onUpdated={(u) => {
                onLabelUpdated(idx, u);
              }}
              isEditable={canBeEdited}
              onClicked={() => {
                if (!canBeEdited) {
                  dispatch(setLabelIndex(idx));
                }
              }}
            />
          );
        }
      })}
    </svg>
  );
}
