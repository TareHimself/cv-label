/* eslint-disable @typescript-eslint/no-unused-vars */
import { ICanvasDrawData, CanvasController, ICanvasPrepData, RenderingContextType } from "@window/canvas";
import { createContextMenu } from "@window/context-menu";
import { generateHitId, watchMouseMovement } from "@window/utils";
import { deepCloneObject } from "@root/utils";
import { v4 as uuidv4 } from 'uuid';
import { IDatabaseAnnotation, IDatabasePoint, ELabelType, Vector2, EEditorMode } from "@types";
import { useEditorState } from "@hooks/useEditorState";

function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

interface ILabelerControllerConfig {
    renderWidth: number;
    renderHeight: number;
}

type HitTestCallback = (ev: MouseEvent) => void;

type HitUnbind = () => void;

type ILabelerDrawData<ContextType extends RenderingContextType> = ICanvasDrawData<ContextType>;

type BindableMouseEvents = "click" | "mousedown" | "mouseenter" | "mouseleave" | "mousemove" | "mouseout" | "mouseover" | "mouseup" | "contextmenu";

type LabelerContextTypes = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

class Drawable {
    owner: LabelerController
    annotation: IDatabaseAnnotation;
    drawerIndex: number;
    drawableHitId = generateHitId();
    callOnDestroy: (() => void)[] = []
    controlPointIds: string[] = [];
    controlPointLineIds: string[] = [];

    get isSelected() {
        return this.drawerIndex === this.owner.selectedControlPoint;
    }

    constructor(owner: LabelerController, annotation: IDatabaseAnnotation, drawerIdx: number) {
        this.owner = owner;
        this.annotation = annotation;
        this.drawerIndex = drawerIdx;
    }

    onCreate() {
        /** */
    }

    onDestroy() {
        this.callOnDestroy.forEach(c => c());
    }

    draw(
        data: ILabelerDrawData<CanvasRenderingContext2D>
    ) {
        /** */
    }

    drawBounds(
        data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>
    ) {
        /** */
    }

    drawControlPointBounds(
        data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>
    ) {
        /** */
    }

    bindHitEvent(hitId: string, event: BindableMouseEvents, eventCallback: HitTestCallback) {
        const unbind = this.owner.bindHitEvent(hitId, event, eventCallback);
        this.callOnDestroy.push(unbind);
        return;
    }

    drawControlPoint(ctx: LabelerContextTypes, x: number, y: number, radius: number, color: string, outlineSize = 0, outlineColor = "black") {
        if (outlineSize > 0) {
            ctx.beginPath();
            ctx.arc(x, y, radius + outlineSize, 0, 2 * Math.PI);
            ctx.fillStyle = outlineColor;
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    drawPolygon<T>(ctx: LabelerContextTypes, data: T[], transform: (a: T) => Vector2, color: string, fill: boolean, lineWidth = 1) {
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (fill) ctx.fillStyle = color;

        ctx.lineWidth = lineWidth;

        const transformedPoints = data.map(c => transform(c));

        ctx.strokeStyle = color;

        const startPoint = transformedPoints[0];

        ctx.moveTo(startPoint.x, startPoint.y);

        for (let i = 0; i < transformedPoints.length; i++) {

            const nextPoint = transformedPoints[(i + 1) % transformedPoints.length];

            ctx.lineTo(nextPoint.x, nextPoint.y);
        }

        //if (closed) ctx.closePath();

        if (fill) {
            ctx.fill();
        }
        else {
            ctx.stroke();
        }
    }
}

class BoxDrawable extends Drawable {

    override onCreate(): void {

        // Selection and dragging
        this.bindHitEvent(this.drawableHitId, "mousedown", (e) => {
            console.log("Box Clicked")
            if (e.button !== 0) return;
            if (this.owner.editorMode !== EEditorMode.SELECT) return

            const rect = this.owner.getCanvasRect()

            if (this.isSelected) {
                const startPositions: Vector2[] = deepCloneObject(this.annotation.points)

                const initial: Vector2 = {
                    x: e.clientX - rect.x,
                    y: e.clientY - rect.y
                }

                let movedMouse = false;
                watchMouseMovement((mouseMoveEvent) => {
                    movedMouse = true;
                    const dx = ((mouseMoveEvent.clientX - rect.x) - initial.x) * this.owner.imageSpaceScale
                    const dy = ((mouseMoveEvent.clientY - rect.y) - initial.y) * this.owner.imageSpaceScale
                    this.annotation.points.forEach((point, idx) => {
                        point.x = startPositions[idx].x + dx
                        point.y = startPositions[idx].y + dy
                    })
                },
                    () => {
                        if (!movedMouse) return;
                        useEditorState.getState().updatePoints(this.owner.sampleId, this.annotation.id, this.annotation.points)

                    })
            }
            else {
                this.owner.setAnnotationIndex(this.drawerIndex);
            }
            e.stopImmediatePropagation()
        })

        // Show Context Menu
        this.bindHitEvent(this.drawableHitId, "contextmenu", (e) => {
            if (e.button !== 2) return;

            if (this.owner.editorMode !== EEditorMode.SELECT) return

            createContextMenu(e, [{
                name: "Delete",
                callback: ({ sampleId, annotationId }) => {
                    useEditorState.getState().removeAnnotations(sampleId, [annotationId])
                }
            }], {
                sampleId: this.owner.sampleId,
                annotationId: this.annotation.id
            })

            e.stopImmediatePropagation();
        })

        // Control points and reshaping
        this.controlPointIds = this.annotation.points.map((c, pointIdx) => {
            const id = generateHitId();


            this.bindHitEvent(id, "mousedown", (mouseDownEvent) => {
                if (mouseDownEvent.button !== 0) return;
                const point = this.annotation.points[pointIdx];

                console.log("Control point hit", this.annotation.points[pointIdx])

                const rect = this.owner.getCanvasRect()

                const startPosition: Vector2 = {
                    x: point.x,
                    y: point.y
                }

                const initial: Vector2 = {
                    x: mouseDownEvent.clientX - rect.x,
                    y: mouseDownEvent.clientY - rect.y
                }

                let movedMouse = false;
                watchMouseMovement((mouseMoveEvent) => {
                    movedMouse = true;

                    const dx = ((mouseMoveEvent.clientX - rect.x) - initial.x) * this.owner.imageSpaceScale
                    const dy = ((mouseMoveEvent.clientY - rect.y) - initial.y) * this.owner.imageSpaceScale

                    point.x = startPosition.x + dx
                    point.y = startPosition.y + dy

                    console.log("Moving Control point")
                }, () => {
                    if (!movedMouse) return;
                    useEditorState.getState().updatePoints(this.owner.sampleId, this.annotation.id, [
                        point
                    ]
                    )
                })

                mouseDownEvent.stopImmediatePropagation()
            })

            return id;
        })
    }

    override draw(data: ILabelerDrawData<CanvasRenderingContext2D>): void {
        const { ctx } = data;

        const originalPoints = this.annotation.points;

        const points: Vector2[] = [{
            x: originalPoints[0].x,
            y: originalPoints[0].y
        }, {
            x: originalPoints[1].x,
            y: originalPoints[0].y
        }, {
            x: originalPoints[1].x,
            y: originalPoints[1].y
        }, {
            x: originalPoints[0].x,
            y: originalPoints[1].y
        }];


        this.drawPolygon(ctx, points, (a) => ({ x: a.x / this.owner.imageSpaceScale, y: a.y / this.owner.imageSpaceScale }), "red", false, 1);

        if (this.isSelected) {
            for (const point of originalPoints) {
                this.drawControlPoint(ctx, point.x / this.owner.imageSpaceScale, point.y / this.owner.imageSpaceScale, 4, "white", 1, "black")
            }
        }

        // if (window.debugHitTest) {
        //     const fillColor = `rgba(${this.drawableHitId},0.3)`;

        //     this.drawPolygon(ctx, points, (a) => ({ x: a.x * this.owner.imageSpaceScale, y: a.y * this.owner.imageSpaceScale }), fillColor, true, 1);

        //     if (this.isSelected) {
        //         for (let i = 0; i < this.annotation.points.length; i++) {
        //             const point = this.annotation.points[i];
        //             const hitId = this.controlPointIds[i];

        //             this.drawControlPoint(ctx, point.x * this.owner.imageSpaceScale, point.y * this.owner.imageSpaceScale, 5, `rgb(${hitId})`)
        //         }
        //     }
        // }
    }

    override drawBounds(data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>): void {
        const { ctx } = data;

        const originalPoints = this.annotation.points;

        const points: Vector2[] = [{
            x: originalPoints[0].x,
            y: originalPoints[0].y
        }, {
            x: originalPoints[1].x,
            y: originalPoints[0].y
        }, {
            x: originalPoints[1].x,
            y: originalPoints[1].y
        }, {
            x: originalPoints[0].x,
            y: originalPoints[1].y
        }];

        const fillColor = `rgb(${this.drawableHitId})`;

        this.drawPolygon(ctx, points, (a) => ({ x: a.x / this.owner.imageSpaceScale, y: a.y / this.owner.imageSpaceScale }), fillColor, true, 1);
    }

    override drawControlPointBounds(
        data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>
    ) {

        const { ctx } = data;

        const originalPoints = this.annotation.points;

        for (let i = 0; i < originalPoints.length; i++) {
            const point = originalPoints[i];
            const hitId = this.controlPointIds[i];

            this.drawControlPoint(ctx, point.x / this.owner.imageSpaceScale, point.y / this.owner.imageSpaceScale, 5, `rgb(${hitId})`)
        }
    }
}

class SegmentationDrawable extends Drawable {
    lineHitIds: string[] = []
    override onCreate(): void {

        // Selection And Dragging
        this.bindHitEvent(this.drawableHitId, "mousedown", (e) => {
            if (e.button !== 0) return;

            if (this.owner.editorMode !== EEditorMode.SELECT) return

            const rect = this.owner.getCanvasRect()

            if (this.isSelected) {
                const startPositions: Vector2[] = deepCloneObject(this.annotation.points)

                const initial: Vector2 = {
                    x: e.clientX - rect.x,
                    y: e.clientY - rect.y
                }

                let movedMouse = false;
                watchMouseMovement((mouseMoveEvent) => {
                    movedMouse = true;

                    const dx = ((mouseMoveEvent.clientX - rect.x) - initial.x) * this.owner.imageSpaceScale
                    const dy = ((mouseMoveEvent.clientY - rect.y) - initial.y) * this.owner.imageSpaceScale

                    this.annotation.points.forEach((point, idx) => {
                        point.x = startPositions[idx].x + dx
                        point.y = startPositions[idx].y + dy
                    })
                },
                    () => {
                        if (!movedMouse) return;
                        useEditorState.getState().updatePoints(this.owner.sampleId, this.annotation.id, this.annotation.points)
                    })
            }
            else {
                this.owner.setAnnotationIndex(this.drawerIndex);
            }

            e.stopImmediatePropagation()
        })

        // Show Context Menu
        this.bindHitEvent(this.drawableHitId, "contextmenu", (e) => {
            if (e.button !== 2) return;

            if (this.owner.editorMode !== EEditorMode.SELECT) return

            createContextMenu(e, [{
                name: "Delete",
                callback: ({ sampleId, annotationId }) => {
                    useEditorState.getState().removeAnnotations(sampleId, [annotationId])
                }
            }], {
                sampleId: this.owner.sampleId,
                annotationId: this.annotation.id
            })

            e.stopImmediatePropagation();
        })


        // Control points and reshaping
        this.controlPointIds = this.annotation.points.map((c, pointIdx) => {
            const id = generateHitId();


            this.bindHitEvent(id, "mousedown", (mouseDownEvent) => {
                if (mouseDownEvent.button !== 0) return;
                const point = this.annotation.points[pointIdx];

                console.log("Control point hit", this.annotation.points[pointIdx])

                const rect = this.owner.getCanvasRect()

                const startPosition: Vector2 = {
                    x: point.x,
                    y: point.y
                }

                const initial: Vector2 = {
                    x: mouseDownEvent.clientX - rect.x,
                    y: mouseDownEvent.clientY - rect.y
                }

                let movedMouse = false;
                watchMouseMovement((mouseMoveEvent) => {
                    movedMouse = true;

                    const dx = ((mouseMoveEvent.clientX - rect.x) - initial.x) * this.owner.imageSpaceScale
                    const dy = ((mouseMoveEvent.clientY - rect.y) - initial.y) * this.owner.imageSpaceScale

                    point.x = startPosition.x + dx
                    point.y = startPosition.y + dy
                    //const { scaleX: x, scaleY: y } = drawable.scale
                    console.log("Moving Control point")
                }, () => {
                    if (!movedMouse) return;
                    useEditorState.getState().updatePoints(this.owner.sampleId, this.annotation.id, [
                        point
                    ])
                })

                mouseDownEvent.stopImmediatePropagation()
            })

            this.bindHitEvent(id, "contextmenu", (e) => {
                if (e.button !== 2) return;

                if (this.annotation.points.length > 3) {
                    useEditorState.getState().removePoints(this.owner.sampleId, this.annotation.id, [c.id])
                }
                e.stopImmediatePropagation();
            })

            return id;
        })

        this.lineHitIds = this.annotation.points.map((c, pointIdx) => {
            const id = generateHitId();

            this.bindHitEvent(id, 'click', (e) => {
                const rect = this.owner.getCanvasRect()

                const [mouseClickX, mouseClickY] = [Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top)];

                console.log("Line Clicked", id)
                const newPoint: IDatabasePoint = {
                    id: uuidv4(),
                    x: mouseClickX * this.owner.imageSpaceScale,
                    y: mouseClickY * this.owner.imageSpaceScale
                }

                const newPoints = [...this.annotation.points.slice(0, pointIdx + 1), newPoint, ...this.annotation.points.slice(pointIdx + 1)];

                useEditorState.getState().replacePoints(this.owner.sampleId, this.annotation.id, newPoints)
            });

            return id;
        });
    }


    override draw(data: ILabelerDrawData<CanvasRenderingContext2D>): void {
        const { ctx } = data;

        this.drawPolygon(ctx, this.annotation.points, (a) => ({ x: a.x / this.owner.imageSpaceScale, y: a.y / this.owner.imageSpaceScale }), "red", false, 1);

        if (this.isSelected) {
            for (const point of this.annotation.points) {
                this.drawControlPoint(ctx, point.x / this.owner.imageSpaceScale, point.y / this.owner.imageSpaceScale, 4, "white", 1, "black")
            }
        }
    }

    override drawBounds(data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>): void {
        const { ctx } = data;

        const fillColor = `rgb(${this.drawableHitId})`;

        const transformedPoints = this.annotation.points.map((a) => ({ x: a.x / this.owner.imageSpaceScale, y: a.y / this.owner.imageSpaceScale }));

        this.drawPolygon(ctx, transformedPoints, (a) => a, fillColor, true, 1);

        if (this.isSelected) {
            // this.drawPolygon(ctx, this.annotation.points, (a) => ({ x: a.x * this.owner.imageSpaceScale, y: a.y * this.owner.imageSpaceScale }), fillColor, true, 1);

            for (let i = 0; i < transformedPoints.length; i++) {
                const start = transformedPoints[i];
                const end = transformedPoints[(i + 1) % transformedPoints.length];
                ctx.beginPath();
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.lineWidth = 7;
                ctx.strokeStyle = `rgb(${this.lineHitIds[i]})`;
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
                ctx.closePath();
            }

            for (let i = 0; i < this.annotation.points.length; i++) {
                const point = this.annotation.points[i];
                const hitId = this.controlPointIds[i];

                this.drawControlPoint(ctx, point.x / this.owner.imageSpaceScale, point.y / this.owner.imageSpaceScale, 5, `rgb(${hitId})`)
            }
        }
    }

    override drawControlPointBounds(
        data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>
    ) {

        const { ctx } = data;

        //this.drawPolygon(ctx, this.annotation.points, (a) => ({ x: a.x * this.owner.imageSpaceScale, y: a.y * this.owner.imageSpaceScale }), this.lineHitIds, false, 1);
        for (let i = 0; i < this.annotation.points.length; i++) {
            const point = this.annotation.points[i];
            const hitId = this.controlPointIds[i];

            this.drawControlPoint(ctx, point.x / this.owner.imageSpaceScale, point.y / this.owner.imageSpaceScale, 5, `rgb(${hitId})`)
        }
    }
}

type MouseEventCallbackValue = {
    listener: (event: MouseEvent) => void;
    callbacks: Map<string, HitTestCallback>;
}
export default class LabelerController extends CanvasController<CanvasRenderingContext2D> {
    drawers: Drawable[] = [];
    annotations: IDatabaseAnnotation[] = [];
    state: ReturnType<typeof useEditorState.getState> = useEditorState.getState();
    lastDrawTime: DOMHighResTimeStamp = 0;
    endCallbacks: (() => void)[] = []
    isActive = false;
    cavasCtx: CanvasRenderingContext2D | null = null;
    hitTestCanvases: OffscreenCanvasRenderingContext2D[] = [];
    currentHitTestCanvas = 0
    selectedControlPoint = -1
    mouseEventCallbacks: Map<BindableMouseEvents, MouseEventCallbackValue> = new Map();
    createdAt: DOMHighResTimeStamp

    get editorMode() {
        return this.state.mode
    }

    get sampleId() {
        return this.state.sampleIds[this.state.selectedSampleIndex]
    }

    get imageSpaceScale() {
        return this.state.imageSize.width / this.state.imageDisplayedRect.width
    }

    constructor() {
        super();
        this.createdAt = performance.now();
    }

    getCanvasRect() {
        return this.cavasCtx!.canvas.getBoundingClientRect()
    }

    bindHitEvent(hitId: string, event: BindableMouseEvents, eventCallback: HitTestCallback): HitUnbind {

        if (this.cavasCtx === null) throw new Error("Canvas Ctx is not valid");

        // Add the event type to the map if we dont already have it
        if (!this.mouseEventCallbacks.has(event)) {
            const listener = ((eventName: BindableMouseEvents, event: MouseEvent) => {
                if (this.hitTestCanvases !== null) {
                    const rect = this.getCanvasRect()

                    const [mouseX, mouseY] = [Math.round(event.clientX - rect.left), Math.round(event.clientY - rect.top)];

                    const [r, g, b, a] = this.hitTestCanvases[this.currentHitTestCanvas].getImageData(mouseX, mouseY, 1, 1).data

                    if (a === 0) {
                        if (this.selectedControlPoint !== -1) {
                            this.setAnnotationIndex(-1);
                        }
                        return;
                    }

                    const hitIdDetected = `${r},${g},${b}`

                    const callback = this.mouseEventCallbacks.get(eventName)?.callbacks.get(hitIdDetected)

                    if (callback !== undefined) {
                        callback(event);
                    }
                }

            }).bind(this, event)
            this.mouseEventCallbacks.set(event, {
                listener,
                callbacks: new Map()
            })
        }

        const mouseEventCallback = this.mouseEventCallbacks.get(event) as MouseEventCallbackValue

        mouseEventCallback.callbacks.set(hitId, eventCallback)

        if (this.mouseEventCallbacks.size === 1) {
            this.cavasCtx?.canvas.addEventListener(event, mouseEventCallback.listener)
        }

        return () => {
            mouseEventCallback.callbacks.delete(hitId);

            const callbacksLength = mouseEventCallback.callbacks.size

            if (callbacksLength !== 0) {
                this.cavasCtx?.canvas.removeEventListener(event, mouseEventCallback.listener);
                this.mouseEventCallbacks.delete(event);
            }
        }
    }

    setAnnotationIndex(idx: number) {
        console.log("Updating annotation Index To", idx)

        this.selectedControlPoint = idx;
        this.state.setSelectedAnnotationIndex(idx);
    }

    override onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
        console.log("Creating labeler")
        this.cavasCtx = data.ctx
        data.ctx.canvas.width = this.state.imageDisplayedRect.width;
        data.ctx.canvas.height = this.state.imageDisplayedRect.height;
        {
            const c1 = new OffscreenCanvas(data.ctx.canvas.width, data.ctx.canvas.height).getContext('2d', {
                willReadFrequently: true
            });
            const c2 = new OffscreenCanvas(data.ctx.canvas.width, data.ctx.canvas.height).getContext('2d', {
                willReadFrequently: true
            });
            if (c1 !== null && c2 !== null) {
                this.hitTestCanvases = [c1, c2]
            }
        }

        // Debug function for viewing the collision canvas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).exportCollisionCanvas = async () => {
            const blob = await this.hitTestCanvases[this.currentHitTestCanvas]?.canvas.convertToBlob()
            if (blob !== undefined) {
                // URL.createObjectURL(blob)
                return URL.createObjectURL(blob)//await blobToBase64(blob);
            }
            return undefined;
        }

        const stateCallback = (state: ReturnType<typeof useEditorState.getState>, prevState: ReturnType<typeof useEditorState.getState>) => {

            this.state = state;
            if (this.cavasCtx && this.hitTestCanvases) {
                this.cavasCtx.canvas.width = this.state.imageDisplayedRect.width;
                this.cavasCtx.canvas.height = this.state.imageDisplayedRect.height;
                for (const ctx of this.hitTestCanvases) {
                    ctx.canvas.width = this.state.imageDisplayedRect.width;
                    ctx.canvas.height = this.state.imageDisplayedRect.height;
                }

            }

            const editorModeChanged = state.mode != prevState.mode;

            const currentSample = this.state.samples.get(this.state.sampleIds[this.state.selectedSampleIndex]);

            const annotations = currentSample?.annotations ?? [];

            this.selectedControlPoint = this.state.selectedAnnotationIndex;

            if (editorModeChanged || this.shouldReplaceDrawers(annotations)) {
                this.createDrawers(annotations)
            }

        }

        this.endCallbacks.push(useEditorState.subscribe(stateCallback))

        this.lastDrawTime = performance.now()

        const animationFrameCallback = (() => {

            this.draw({
                ...data,
                ctx: data.ctx,
            })

            if (this.isActive) {
                requestAnimationFrame(animationFrameCallback);
            }
        }).bind(this)

        this.endCallbacks.push((() => this.isActive = false).bind(this))

        this.isActive = true;


        // Draw initial state
        stateCallback(this.state, this.state);

        requestAnimationFrame(animationFrameCallback);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override onEnd(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
        this.cavasCtx = null;
        this.endCallbacks.forEach(c => c())
        this.createDrawers([])
    }

    override getContext(
        canvas: HTMLCanvasElement
    ): CanvasRenderingContext2D | null {
        return canvas.getContext("2d");
    }

    createDrawers(annotations: IDatabaseAnnotation[]) {
        this.drawers.map(c => c.onDestroy());
        this.drawers = [];

        this.drawers = annotations.map((a, idx) => {

            const drawer = a.type === ELabelType.BOX ? new BoxDrawable(this, deepCloneObject(a), idx) : new SegmentationDrawable(this, deepCloneObject(a), idx)
            drawer.onCreate();
            return drawer;
        })

        this.annotations = deepCloneObject(annotations);
    }

    shouldReplaceDrawers(annotations: IDatabaseAnnotation[]) {
        if (annotations.length !== this.annotations.length) {
            console.log("Creating new drawers because the number annotations have changed")
            return true;
        }

        for (let i = 0; i < annotations.length; i++) {
            const stateAnnotation = annotations[i];
            const myAnnotation = this.annotations[i];

            if (stateAnnotation.id !== myAnnotation.id || stateAnnotation.points.length !== myAnnotation.points.length) {
                console.log("Creating new drawers because the annotation with id", stateAnnotation.id, "has changed")
                return true;
            }

            if (JSON.stringify(stateAnnotation.points) !== JSON.stringify(myAnnotation.points)) {
                console.log("Creating new drawers because the points of the annotation with id", stateAnnotation.id, "Have changed", stateAnnotation.points)
                return true;
            }
        }

        return false;
    }

    override draw(data: ILabelerDrawData<CanvasRenderingContext2D>): void {
        // console.log("Scale",this.imageSpaceScale)
        // const delta = data.step - this.lastDrawTime;


        const currentSample = this.state.samples.get(this.state.sampleIds[this.state.selectedSampleIndex]);

        if (currentSample === undefined) {
            return;
        }

        const { ctx } = data;

        if (ctx.canvas.width <= 0 || ctx.canvas.height <= 0) {
            return
        }

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const currentHitCanvasIndex = this.currentHitTestCanvas
        const nextHitCanvasIndex = (this.currentHitTestCanvas + 1) % 2
        const currentHitCtx = this.hitTestCanvases[currentHitCanvasIndex]
        const nextHitCtx = this.hitTestCanvases[nextHitCanvasIndex]

        nextHitCtx.clearRect(0, 0, nextHitCtx.canvas.width, nextHitCtx.canvas.height)


        const boundsDrawData: ILabelerDrawData<OffscreenCanvasRenderingContext2D> | undefined = this.hitTestCanvases !== null ? {
            ...data,
            ctx: nextHitCtx
        } : undefined

        for (const drawable of this.drawers) {
            drawable.draw(data);

            if (boundsDrawData !== undefined) {
                drawable.drawBounds(boundsDrawData)
            }
        }

        // Draw control point bounds last so they can always be clicked
        if (boundsDrawData !== undefined && this.selectedControlPoint !== -1 && this.selectedControlPoint < this.drawers.length) {
            this.drawers[this.selectedControlPoint].drawControlPointBounds(boundsDrawData);
        }

        this.currentHitTestCanvas = nextHitCanvasIndex

        currentHitCtx.drawImage(nextHitCtx.canvas, 0, 0)

        if (window.debugHitTest) {
            const offscreenCanvasCtx = boundsDrawData?.ctx;
            const canvasCtx = data.ctx;

            if (offscreenCanvasCtx && canvasCtx && offscreenCanvasCtx.canvas.width > 0 && offscreenCanvasCtx.canvas.height > 0) {
                //const data = offscreenCanvasCtx.getImageData(0,0,offscreenCanvasCtx.canvas.width,offscreenCanvasCtx.canvas.height)
                const oldGlobalAlpha = canvasCtx.globalAlpha;
                canvasCtx.globalAlpha = 0.3
                canvasCtx.drawImage(offscreenCanvasCtx.canvas, 0, 0);
                canvasCtx.globalAlpha = oldGlobalAlpha;
            }
        }
    }
}