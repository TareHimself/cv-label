import useMouseUp from "@hooks/useMouseUp";
import { useAppSelector } from "@redux/hooks";
import { useCallback, useEffect, useState } from "react";

export type PolygonProps = {
  points: [number, number][];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  isRect: boolean;
  onDragCompleted: (
    points: PolygonProps["points"]
  ) => PolygonProps["points"] | undefined;
  isEditable: boolean;
  onClicked?: () => void;
};

type PolygonControlPointProps = {
  x: number;
  y: number;
  onMoved: (pos: [number, number]) => void;
  onMoveEnded: (pos: [number, number]) => void;
  onMoveCancelled: (pos: [number, number]) => void;
};
function PolygonControlPoint({
  x,
  y,
  onMoved,
  onMoveEnded,
}: PolygonControlPointProps) {
  const [isBeingDragged, setIsBeingDragged] = useState(false);

  const labelerRect = useAppSelector((s) => s.editor.labelerRect);

  useEffect(() => {
    if (isBeingDragged) {
      const callback = (ev: MouseEvent) => {
        const newPos: [number, number] = [
          ev.clientX - labelerRect.x,
          ev.clientY - labelerRect.y,
        ];

        onMoved(newPos);

        // setPos((curPos) => {

        //   onMoved(newPos)
        //   return curPos
        // })
      };

      window.addEventListener("mousemove", callback);

      return () => {
        window.removeEventListener("mousemove", callback);
      };
    }
  }, [isBeingDragged, labelerRect.x, labelerRect.y, onMoved, x, y]);

  useMouseUp(
    useCallback(() => {
      if (isBeingDragged) {
        onMoveEnded([x, y]);
        setIsBeingDragged(false);
      }
    }, [isBeingDragged, onMoveEnded, x, y])
  );

  return (
    <circle
      cx={x}
      cy={y}
      r="5"
      style={{
        fill: "white",
        stroke: "black",
        strokeWidth: 0.5,
      }}
      onMouseDown={(e) => {
        setIsBeingDragged(true);
        e.stopPropagation();
        e.preventDefault();
      }}
      // onMouseOut={() => {
      //   if (isBeingDragged) {
      //     onMoveCancelled([x, y]);
      //   }
      //   setIsBeingDragged(false);
      // }}
      className="control-point"
    />
  );
}

function matchRectDims(
  indexChanged: number,
  oldPos: [number, number],
  newPos: [number, number],
  rect: [number, number][]
) {
  const neighborIndexes: number[] = [];

  if (indexChanged === 0 || indexChanged === 3) {
    indexChanged === 0
      ? neighborIndexes.push(3, 1)
      : neighborIndexes.push(2, 0);
  } else {
    neighborIndexes.push(indexChanged - 1, indexChanged + 1);
  }

  for (const index of neighborIndexes) {
    const item = rect[index];

    if (item[0] === oldPos[0]) {
      rect[index][0] = newPos[0];
    } else if (item[1] === oldPos[1]) {
      rect[index][1] = newPos[1];
    }
  }

  const x1 = Math.min(...rect.map((a) => a[0]));
  const y1 = Math.min(...rect.map((a) => a[1]));
  const x2 = Math.max(...rect.map((a) => a[0]));
  const y2 = Math.max(...rect.map((a) => a[1]));

  const newRect: [number, number][] = [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];

  return newRect;
}
export default function Polygon(props: PolygonProps) {
  const originalPoints = props.points;
  const [points, setPoints] = useState(originalPoints);

  const [isBeingDragged, setIsBeingDragged] = useState(false);

  useEffect(() => {
    if (isBeingDragged) {
      const callback = (ev: MouseEvent) => {
        setPoints((p) => {
          return p.map(([x, y]) => [x + ev.movementX, y + ev.movementY]);
        });
      };

      window.addEventListener("mousemove", callback);

      return () => {
        window.removeEventListener("mousemove", callback);
      };
    }
  }, [isBeingDragged]);

  useMouseUp(
    useCallback(() => {
      if (isBeingDragged) {
        setPoints(props.onDragCompleted(points) ?? originalPoints);
        setIsBeingDragged(false);
      }
    }, [isBeingDragged, originalPoints, points, props])
  );

  return (
    <>
      <polygon
        points={points.map((a) => a.join(",")).join(" ")}
        style={{
          fill: props.fill ?? "rgba(255,0,0,0.1)",
          stroke: props.stroke ?? "green",
          strokeWidth: props.strokeWidth ?? 1,
        }}
        // onClick={}
        onMouseDown={(e) => {
          if (props.isEditable) {
            setIsBeingDragged(true);
            e.stopPropagation();
          } else {
            if (props.onClicked) {
              props.onClicked();
            }
          }
        }}
        // onMouseOut={() => {
        //   if (props.isEditable) {
        //     if (isBeingDragged) setPoints(originalPoints);
        //   }
        //   setIsBeingDragged(false);
        // }}
      />
      {(props.isEditable ? points : []).map(([x1, y1], pointIdx) => (
        <PolygonControlPoint
          x={x1}
          y={y1}
          onMoved={(pos) => {
            setPoints((pts) => {
              const oldPt = pts[pointIdx];
              pts[pointIdx] = pos;

              if (props.isRect && props.points.length === 4) {
                return matchRectDims(pointIdx, oldPt, pos, [...pts]);
              }

              return [...pts];
            });
            return pos;
          }}
          onMoveEnded={(pos) => {
            const oldPos = points[pointIdx];
            let oldPts = [...points];
            oldPts[pointIdx] = pos;
            if (props.isRect && props.points.length === 4) {
              oldPts = matchRectDims(pointIdx, oldPos, pos, oldPts);
            }
            setPoints(props.onDragCompleted(oldPts) ?? originalPoints);
          }}
          onMoveCancelled={() => {
            setPoints(originalPoints);
          }}
          key={`point-idx-${pointIdx}`}
        />
      ))}
    </>
  );
}
