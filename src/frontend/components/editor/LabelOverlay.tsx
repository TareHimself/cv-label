import Polygon from "@components/Polygon";
import {
  CvBoxLabel,
  CvSegmentLabel,
  ELabelType,
  LabelOverlayProps,
} from "@types";

type DrawProps<T> = {
  label: T;
  image: LabelOverlayProps["image"];
  onUpdated: (update: T) => void;
};

function DrawBox({ label, image, onUpdated }: DrawProps<CvBoxLabel>) {
  const [scaleX, scaleY] = [
    image.width / image.naturalWidth,
    image.height / image.naturalHeight,
  ];

  const { x1, y1, x2, y2 } = label;

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
          x1: Math.min(...newPoints.map((a) => a[0])),
          y1: Math.min(...newPoints.map((a) => a[1])),
          x2: Math.max(...newPoints.map((a) => a[0])),
          y2: Math.max(...newPoints.map((a) => a[1])),
        });
        return newPoints;
      }}
      isRect={true}
    />
  );
}

function DrawSegment({ label, image, onUpdated }: DrawProps<CvSegmentLabel>) {
  const [scaleX, scaleY] = [
    image.width / image.naturalWidth,
    image.height / image.naturalHeight,
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
    />
  );
}

export default function LabelOverlay({
  labels,
  image,
  onLabelUpdated,
}: LabelOverlayProps) {
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: image.width,
        height: image.height,
      }}
      id="label-overlay"
    >
      {labels.map((a, idx) => {
        if (a.type === ELabelType.BOX) {
          return (
            <DrawBox
              label={a}
              image={image}
              key={`label-${idx}`}
              onUpdated={(u) => {
                onLabelUpdated(idx, u);
              }}
            />
          );
        } else {
          return (
            <DrawSegment
              label={a}
              image={image}
              key={`label-${idx}`}
              onUpdated={(u) => {
                onLabelUpdated(idx, u);
              }}
            />
          );
        }
      })}
    </svg>
  );
}
