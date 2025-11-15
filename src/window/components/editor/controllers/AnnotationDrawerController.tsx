import {
  CanvasController,
  ICanvasDrawData,
  ICanvasPrepData,
} from "@window/canvas";
import { v4 as uuidv4 } from "uuid";
import { EEditorMode, ELabelType, IDatabasePoint, Vector2 } from "@types";
import { watchMouseMovement } from "@window/utils";
import { useEditorState } from "@hooks/useEditorState";

type PossibleDrawModes = EEditorMode.CREATE_BOX | EEditorMode.CREATE_SEGMENT;

interface IAnnotationDrawerControllerConfig {
  drawMode: PossibleDrawModes;
  renderWidth: number;
  renderHeight: number;
  initialPoints: IDatabasePoint[];
}

const MIN_PIXEL_DISTANCE = 30;
export default class AnnotationDrawerController extends CanvasController<CanvasRenderingContext2D> {
  get mode() {
    return this.config.drawMode;
  }
  get points() {
    return this.config.initialPoints;
  }
  cavasCtx: CanvasRenderingContext2D | null = null;
  editorState: ReturnType<typeof useEditorState.getState> =
    useEditorState.getState();
  endCallbacks: (() => void)[] = [];
  isActive = false;
  config: IAnnotationDrawerControllerConfig;
  mousePos: Vector2 = { x: 0, y: 0 };
  get imageSpaceScale() {
    return (
      this.editorState.imageSize.width /
      this.editorState.imageDisplayedRect.width
    );
  }

  constructor(config: IAnnotationDrawerControllerConfig) {
    super();
    this.config = config;
  }

  pushToState() {
    const sampleId =
      this.editorState.sampleIds[this.editorState.selectedSampleIndex];
    if (
      this.points.length >= (this.mode === EEditorMode.CREATE_BOX ? 2 : 3) &&
      sampleId
    ) {
      if (this.mode === EEditorMode.CREATE_BOX) {
        const minDistance = Math.min(
          Math.abs(this.points[0].x - this.points[1].x),
          Math.abs(this.points[0].y - this.points[1].y)
        );
        if (minDistance < MIN_PIXEL_DISTANCE) {
          this.points.splice(0, this.points.length);
          return;
        }
      }

      this.editorState.createAnnotations(sampleId, [
        {
          id: uuidv4(),
          class: 0,
          type:
            this.mode === EEditorMode.CREATE_BOX
              ? ELabelType.BOX
              : ELabelType.SEGMENT,
          points: [...this.points],
        },
      ]);
    }

    this.points.splice(0, this.points.length);
  }

  override onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
    this.cavasCtx = data.ctx;
    data.ctx.canvas.width = this.config.renderWidth;
    data.ctx.canvas.height = this.config.renderHeight;
    const storeSubCallback = (
      newState: ReturnType<typeof useEditorState.getState>
    ) => {
      this.editorState = newState;
    };

    this.endCallbacks.push(useEditorState.subscribe(storeSubCallback));

    if (this.mode === EEditorMode.CREATE_SEGMENT) {
      const clickListener = (e: MouseEvent) => {
        if (e.button !== 0) return;

        const rect = (
          e.currentTarget as HTMLCanvasElement
        ).getBoundingClientRect();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.points.push({
          id: uuidv4(),
          x: mouseX * this.imageSpaceScale,
          y: mouseY * this.imageSpaceScale,
        });

        e.stopImmediatePropagation();
      };

      this.cavasCtx.canvas.addEventListener("click", clickListener);

      this.endCallbacks.push(() => {
        this.cavasCtx?.canvas.removeEventListener("click", clickListener);
      });

      const contextMenuListener = (e: MouseEvent) => {
        if (e.button !== 2) return;
        this.pushToState();
        e.stopImmediatePropagation();
      };

      this.cavasCtx.canvas.addEventListener("contextmenu", contextMenuListener);

      this.endCallbacks.push(() => {
        this.cavasCtx?.canvas.removeEventListener(
          "contextmenu",
          contextMenuListener
        );
      });
    } else {
      const mouseDownListener = (e: MouseEvent) => {
        if (e.button !== 0) return;
        console.log("Mouse Button", e.button);

        const rect = (
          e.currentTarget as HTMLCanvasElement
        ).getBoundingClientRect();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.points.push(
          {
            id: uuidv4(),
            x: mouseX * this.imageSpaceScale,
            y: mouseY * this.imageSpaceScale,
          },
          {
            id: uuidv4(),
            x: mouseX * this.imageSpaceScale,
            y: mouseY * this.imageSpaceScale,
          }
        );

        console.log("Watching mouse move");
        watchMouseMovement(
          (moveEvent) => {
            const mouseX = moveEvent.clientX - rect.left;
            const mouseY = moveEvent.clientY - rect.top;
            this.points[1].x = mouseX * this.imageSpaceScale;
            this.points[1].y = mouseY * this.imageSpaceScale;
          },
          () => {
            this.pushToState();
          }
        );

        e.stopPropagation();
      };

      this.cavasCtx.canvas.addEventListener("mousedown", mouseDownListener);

      this.endCallbacks.push(() => {
        this.cavasCtx?.canvas.removeEventListener(
          "mousedown",
          mouseDownListener
        );
      });
    }

    const animationFrameCallback = (() => {
      this.draw({
        ...data,
        ctx: data.ctx,
      });

      if (this.isActive) {
        requestAnimationFrame(animationFrameCallback);
      }
    }).bind(this);

    this.endCallbacks.push((() => (this.isActive = false)).bind(this));

    this.isActive = true;

    requestAnimationFrame(animationFrameCallback);

    const onMouseMoveListener = (e: MouseEvent) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    };

    window.addEventListener("mousemove", onMouseMoveListener);

    this.endCallbacks.push(() =>
      window.removeEventListener("mousemove", onMouseMoveListener)
    );
  }

  drawPolygon<T>(
    ctx: CanvasRenderingContext2D,
    data: T[],
    transform: (a: T) => Vector2,
    color: string,
    fill: boolean,
    closed: boolean,
    lineWidth = 1
  ) {
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (closed) ctx.fillStyle = color;

    ctx.strokeStyle = color;

    ctx.lineWidth = lineWidth;

    for (const d of data) {
      const { x, y } = transform(d);

      ctx.lineTo(x, y);
    }

    if (closed) ctx.closePath();

    if (fill) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  override draw(data: ICanvasDrawData<CanvasRenderingContext2D>): void {
    const { ctx } = data;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (this.points.length == 0) return;
    //console.log("Drawing",this.points.length,"Points")
    if (this.mode === EEditorMode.CREATE_BOX) {
      if (this.points.length !== 2) {
        return;
      }

      const pointsToDraw: Vector2[] = [
        {
          x: this.points[0].x,
          y: this.points[0].y,
        },
        {
          x: this.points[1].x,
          y: this.points[0].y,
        },
        {
          x: this.points[1].x,
          y: this.points[1].y,
        },
        {
          x: this.points[0].x,
          y: this.points[1].y,
        },
      ];

      this.drawPolygon(
        ctx,
        pointsToDraw,
        (c) => ({
          x: c.x / this.imageSpaceScale,
          y: c.y / this.imageSpaceScale,
        }),
        "red",
        false,
        true,
        1
      );
    } else {
      const rect = ctx.canvas.getBoundingClientRect();
      const mouseX = this.mousePos.x - rect.x;
      const mouseY = this.mousePos.y - rect.y;
      console.log("POINTS",mouseX,mouseY)
      this.drawPolygon(
        ctx,
        [...this.points, { id: "mouse", x: mouseX * this.imageSpaceScale, y: mouseY * this.imageSpaceScale }],
        (c) => ({
          x: c.x / this.imageSpaceScale,
          y: c.y / this.imageSpaceScale,
        }),
        "red",
        false,
        true,
        1
      );
    }
  }

  override getContext(
    canvas: HTMLCanvasElement
  ): CanvasRenderingContext2D | null {
    return canvas.getContext("2d");
  }

  override onEnd(): void {
    this.isActive = false;
    this.endCallbacks.forEach((c) => c());
    this.endCallbacks = [];
  }
}
