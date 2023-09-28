import { useAppSelector } from "@redux/hooks";
import { useEffect } from "react";

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
            mousePosition[0],
            mousePosition[1],
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
              mousePosition[0],
              mousePosition[1],
            ];

            let drawEnd: [number, number] = [0, 0];

            switch (i) {
              case 1:
                drawStart[0] -= circleRadius + lineSpacing;
                drawEnd = [0, mousePosition[1]];
                break;

              case 2:
                drawStart[1] -= circleRadius + lineSpacing;
                drawEnd = [mousePosition[0], 0];
                break;

              case 3:
                drawStart[0] += circleRadius + lineSpacing;
                drawEnd = [editorRect.width, mousePosition[1]];
                break;

              case 4:
                drawStart[1] += circleRadius + lineSpacing;
                drawEnd = [mousePosition[0], editorRect.height];
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
    <canvas
      id="crosshair-canvas"
      style={{
        width: editorRect.width,
        height: editorRect.height,
      }}
    ></canvas>
    // <svg
    //   style={{
    //     width: "100%",
    //     height: "100%",
    //   }}
    // >
    //   <circle
    //     cx={mousePosition[0]}
    //     cy={mousePosition[1]}
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
