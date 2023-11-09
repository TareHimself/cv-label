import useMouseUp from "@hooks/useMouseUp";
import { useAppSelector } from "@redux/hooks";
import { DatabasePoint } from "@root/backend/db";
import { IDatabasePoint } from "@types";
import { useCallback, useEffect, useState } from "react";

export type PolygonProps = {
  points: IDatabasePoint[];
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
        zIndex: 1,
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
  rect: IDatabasePoint[]
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

    if (item.x === oldPos[0]) {
      rect[index].x = newPos[0];
    } else if (item.y === oldPos[1]) {
      rect[index].x = newPos[1];
    }
  }

  const x1 = Math.min(...rect.map((a) => a.x));
  const y1 = Math.min(...rect.map((a) => a.y));
  const x2 = Math.max(...rect.map((a) => a.x));
  const y2 = Math.max(...rect.map((a) => a.y));

  const newRect = [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ].map((t,idx) => ({
    id: rect[idx].id,
    x: t[0],
    y: t[1]
  }));

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
          return p.map((d) => {
            const newD = {...d}
            newD.x += ev.movementX
            newD.y += ev.movementY;
            return newD
          });
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
        points={points.map((a) => `${a.x},${a.y}`).join(" ")}
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
      {(props.isEditable ? points : []).map((pt, pointIdx) => (
        <PolygonControlPoint
          x={pt.x}
          y={pt.y}
          onMoved={(pos) => {
            setPoints((pts) => {
              const oldPt = pts[pointIdx];
              pts[pointIdx] = {
                id: pt.id,
                x: pos[0],
                y: pos[1]
              };

              if (props.isRect && props.points.length === 4) {
                return matchRectDims(pointIdx, [oldPt.x,oldPt.y], pos, [...pts]);
              }

              return [...pts];
            });
            return pos;
          }}
          onMoveEnded={(pos) => {
            const oldPos = points[pointIdx];
            let oldPts = [...points];
            oldPts[pointIdx] = {
                id: pt.id,
                x: pos[0],
                y: pos[1]
              };
            if (props.isRect && props.points.length === 4) {
              oldPts = matchRectDims(pointIdx, [oldPos.x,oldPos.y], pos, oldPts);
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
