import Canvas from "@frontend/canvas";
import { useAppSelector } from "@redux/hooks";
import { useCallback, useEffect } from "react";

export type CrosshairProps = {
  lineLength?: number;
  lineSpacing?: number;
  circleRadius?: number;
  lineColor?: string;
  circleColor?: string;
};

export default function Crosshair(props: CrosshairProps) {
  const lineLength = props.lineLength ?? 100;
  const lineSpacing = props.lineSpacing ?? 5;
  const circleRadius = props.circleRadius ?? 5;
  const lineColor = "white" ?? props.lineColor;
  const circleColor = "white" ?? props.circleColor;

  const editorRect = useAppSelector((s) => s.editor.editorRect);

  useEffect(() => {
    const canvasElement = document.getElementById(
      "crosshair-canvas"
    ) as HTMLCanvasElement | null;
    if (canvasElement) {
      canvasElement.width = editorRect.width;
      canvasElement.height = editorRect.height;

      const ctx = canvasElement?.getContext("2d");

      if (ctx) {
        const callback = (e: MouseEvent) => {
          const mousePosition: [number, number] = [e.clientX, e.clientY];
          ctx.clearRect(0, 0, editorRect.width, editorRect.height);

          ctx.beginPath();
          ctx.strokeStyle = circleColor;
          ctx.ellipse(
            window.mouseScreenX,
            window.mouseScreenY,
            circleRadius,
            circleRadius,
            0,
            0,
            2 * Math.PI
          );
          ctx.stroke();

          for (let i = 1; i < 5; i++) {
            ctx.beginPath();
            const drawStart: [number, number] = [
              window.mouseScreenX,
              window.mouseScreenY,
            ];

            let drawEnd: [number, number] = [0, 0];

            switch (i) {
              case 1:
                drawStart[0] -= circleRadius + lineSpacing;
                drawEnd = [0, window.mouseScreenY];
                break;

              case 2:
                drawStart[1] -= circleRadius + lineSpacing;
                drawEnd = [window.mouseScreenX, 0];
                break;

              case 3:
                drawStart[0] += circleRadius + lineSpacing;
                drawEnd = [editorRect.width, window.mouseScreenY];
                break;

              case 4:
                drawStart[1] += circleRadius + lineSpacing;
                drawEnd = [window.mouseScreenX, editorRect.height];
                break;

              default:
                break;
            }

            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.setLineDash([lineLength, lineSpacing]);
            ctx.moveTo(...drawStart);
            ctx.lineTo(...drawEnd);
            ctx.stroke();
          }
        };

        window.addEventListener("mousemove", callback);

        return () => {
          window.removeEventListener("mousemove", callback);
        };
      }
    }
  }, [
    circleColor,
    circleRadius,
    editorRect.height,
    editorRect.width,
    lineColor,
    lineLength,
    lineSpacing,
  ]);

  return (
    <Canvas<CanvasRenderingContext2D>
      id={"crosshair-canvas"}
      width={editorRect.width}
      height={editorRect.height}
      getContext={useCallback((c) => c.getContext("2d"), [])}
      render={useCallback((d) => {
        const { ctx, canvas }  = d;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.beginPath();
          ctx.strokeStyle = circleColor;
          ctx.ellipse(
            window.mouseScreenX,
            window.mouseScreenY,
            circleRadius,
            circleRadius,
            0,
            0,
            2 * Math.PI
          );
          ctx.stroke();

          for (let i = 1; i < 5; i++) {
            ctx.beginPath();
            const drawStart: [number, number] = [
              window.mouseScreenX,
              window.mouseScreenY,
            ];

            let drawEnd: [number, number] = [0, 0];

            switch (i) {
              case 1:
                drawStart[0] -= circleRadius + lineSpacing;
                drawEnd = [0, window.mouseScreenY];
                break;

              case 2:
                drawStart[1] -= circleRadius + lineSpacing;
                drawEnd = [window.mouseScreenX, 0];
                break;

              case 3:
                drawStart[0] += circleRadius + lineSpacing;
                drawEnd = [canvas.width, window.mouseScreenY];
                break;

              case 4:
                drawStart[1] += circleRadius + lineSpacing;
                drawEnd = [window.mouseScreenX, canvas.height];
                break;

              default:
                break;
            }

            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.setLineDash([lineLength, lineSpacing]);
            ctx.moveTo(...drawStart);
            ctx.lineTo(...drawEnd);
            ctx.stroke();
          }
      }, [circleColor, circleRadius, lineColor, lineLength, lineSpacing])}
    />
    // <canvas
    //   id=
    //   style={{
    //     width: editorRect.width,
    //     height: editorRect.height,
    //   }}
    // ></canvas>
    // <svg
    //   style={{
    //     width: "100%",
    //     height: "100%",
    //   }}
    // >
    //   <circle
    //     cx={window.mouseScreenX}
    //     cy={window.mouseScreenY}
    //     r={circleRadius}
    //     fill={circleColor}
    //     style={{
    //       mixBlendMode: "difference",
    //     }}
    //   />
    //   {leftBars}
    //   {rightBars}
    //   {topBars}
    //   {bottomBars}
    // </svg>
  );
}
