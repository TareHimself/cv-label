import Canvas, {
  CanvasController,
  ICanvasDrawData,
  ICanvasPrepData,
} from "@frontend/canvas";
import { useAppSelector } from "@redux/hooks";
import { useMemo } from "react";

export type CrosshairProps = {
  lineLength?: number;
  lineSpacing?: number;
  circleRadius?: number;
  lineColor?: string;
  circleColor?: string;
};

interface ICanvasControllerConfig {
  lineLength: number;
  lineSpacing: number;
  circleRadius: number;
  lineColor: string;
  circleColor: string;
  renderWidth: number;
  renderHeight: number;
}

interface ICrosshairDrawData extends ICanvasDrawData<CanvasRenderingContext2D> {
  mouse: {
    x: number;
    y: number;
  };
}
class CrosshairController extends CanvasController<
  CanvasRenderingContext2D,
  ICrosshairDrawData
> {
  config: ICanvasControllerConfig;
  mouseEventStopper?: () => void;
  constructor(config: ICanvasControllerConfig) {
    super();
    this.config = config;
  }

  override onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
    data.ctx.canvas.width = this.config.renderWidth;
    data.ctx.canvas.height = this.config.renderHeight;

    const callback = ((ev: MouseEvent) => {
      this.draw({
        ctx: data.ctx,
        mouse: {
          x: ev.clientX,
          y: ev.clientY,
        },
      });
    }).bind(this);

    window.addEventListener("mousemove", callback);
    this.mouseEventStopper = () => {
      window.removeEventListener("mousemove", callback);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override onEnd(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
    if (this.mouseEventStopper !== undefined) {
      this.mouseEventStopper();
    }
  }

  override getContext(
    canvas: HTMLCanvasElement
  ): CanvasRenderingContext2D | null {
    return canvas.getContext("2d");
  }

  override draw(data: ICrosshairDrawData): void {
    const { ctx } = data;
    const { x: mouseX, y: mouseY } = data.mouse;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = this.config.circleColor;
    ctx.ellipse(
      mouseX,
      mouseY,
      this.config.circleRadius,
      this.config.circleRadius,
      0,
      0,
      2 * Math.PI
    );
    ctx.stroke();

    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      const drawStart: [number, number] = [mouseX, mouseY];

      let drawEnd: [number, number] = [0, 0];

      switch (i) {
        case 1:
          drawStart[0] -= this.config.circleRadius + this.config.lineSpacing;
          drawEnd = [0, mouseY];
          break;

        case 2:
          drawStart[1] -= this.config.circleRadius + this.config.lineSpacing;
          drawEnd = [mouseX, 0];
          break;

        case 3:
          drawStart[0] += this.config.circleRadius + this.config.lineSpacing;
          drawEnd = [ctx.canvas.width, mouseY];
          break;

        case 4:
          drawStart[1] += this.config.circleRadius + this.config.lineSpacing;
          drawEnd = [mouseX, ctx.canvas.height];
          break;

        default:
          break;
      }

      ctx.beginPath();
      ctx.strokeStyle = this.config.lineColor;
      ctx.setLineDash([this.config.lineLength, this.config.lineSpacing]);
      ctx.moveTo(...drawStart);
      ctx.lineTo(...drawEnd);
      ctx.stroke();
    }
  }
}
export default function Crosshair(props: CrosshairProps) {
  const lineLength = props.lineLength ?? 100;
  const lineSpacing = props.lineSpacing ?? 5;
  const circleRadius = props.circleRadius ?? 5;
  const lineColor = "white" ?? props.lineColor;
  const circleColor = "white" ?? props.circleColor;

  const editorRect = useAppSelector((s) => s.editor.editorRect);

  return (
    <Canvas<CanvasRenderingContext2D>
      id={"crosshair-canvas"}
      width={editorRect.width}
      height={editorRect.height}
      controller={useMemo(
        () =>
          new CrosshairController({
            lineLength,
            lineSpacing,
            circleRadius,
            lineColor,
            circleColor,
            renderWidth: editorRect.width,
            renderHeight: editorRect.height,
          }),
        [
          circleColor,
          circleRadius,
          editorRect.height,
          editorRect.width,
          lineColor,
          lineLength,
          lineSpacing,
        ]
      )}
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
    //     cx={mouseX}
    //     cy={mouseY}
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
