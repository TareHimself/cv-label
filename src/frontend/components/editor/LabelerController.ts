/* eslint-disable @typescript-eslint/no-unused-vars */
import { ICanvasDrawData, CanvasController, ICanvasPrepData, RenderingContextType } from "@frontend/canvas";
import { generateHitId, subscribeToWindowEvent, watchMouseMovement } from "@frontend/utils";
import { setCurrentAnnotationIndex, updatePoints } from "@redux/exports";
import { store } from "@redux/store";
import { clone } from "@root/utils";
import { IDatabaseAnnotation, IDatabasePoint, ELabelType, Vector2D } from "@types";

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
type HitUnbind = () => void

type ILabelerDrawData<ContextType extends RenderingContextType> = ICanvasDrawData<ContextType>

type BindableMouseEvents = "click" | "mousedown" | "mouseenter" | "mouseleave" | "mousemove" | "mouseout" | "mouseover" | "mouseup"
type LabelerContextTypes = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

class Drawable {
    owner: LabelerController
    annotation: IDatabaseAnnotation<IDatabasePoint[]>;
    drawerIndex: number;
    drawableHitId = generateHitId();
    callOnDestroy: (() => void)[] = []
    controlPointIds: string[] = [];
    controlPointLineIds: string[] = [];
    scale: Vector2D;
    zoom: number;

    get isSelected() {
        return this.drawerIndex === this.owner.selectedControlPoint;
    }

    constructor(owner: LabelerController, annotation: IDatabaseAnnotation<IDatabasePoint[]>, drawerIdx: number,scale: Vector2D,zoom: number) {
        this.owner = owner;
        this.annotation = annotation;
        this.drawerIndex = drawerIdx;
        this.scale = scale;
        this.zoom = zoom;
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

    bindHitEvent(hitId: string,event: BindableMouseEvents, eventCallback: HitTestCallback) {
        const unbind = this.owner.bindHitEvent(hitId,event, eventCallback);
        this.callOnDestroy.push(unbind);
        return;
    }

    drawControlPoint(ctx: LabelerContextTypes ,x: number, y: number, radius: number, color: string, outlineSize = 0, outlineColor = "black"){
        if(outlineSize > 0){
            ctx.beginPath();
            ctx.arc(x,y, radius + outlineSize, 0, 2 * Math.PI);
            ctx.fillStyle = outlineColor;
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(x,y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    drawPolygon<T>(ctx: LabelerContextTypes,data: T[],transform: (a: T) => Vector2D,color:string,fill: boolean,closed: boolean,lineWidth = 1){
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if(closed) ctx.fillStyle = color;

        ctx.strokeStyle = color;

        ctx.lineWidth = lineWidth;


        for (const d of data) {
            const { x, y } = transform(d);

            ctx.lineTo(x,y);
        }

        if(closed) ctx.closePath();

        if(fill){
            ctx.fill();
        }
        else
        {
            ctx.stroke();
        }
    }
}

class BoxDrawable extends Drawable {

    override onCreate(): void {

        // Selection and dragging
        this.bindHitEvent(this.drawableHitId,"mousedown", (e) => {
            
            if(this.isSelected){
                const startPositions: Vector2D[] = this.annotation.points.map(c => ({
                    x: c.x *  this.scale.x,
                    y: c.y * this.scale.y
                }))

                const positionDiff: Vector2D = {
                    x: 0,
                    y: 0
                }

                watchMouseMovement((mouseMoveEvent) => {
                    //const { scaleX: x, scaleY: y } = drawable.scale
                    positionDiff.x += mouseMoveEvent.movementX;
                    positionDiff.y += mouseMoveEvent.movementY;

                    

                    this.annotation.points.forEach((point,idx) => {
                        point.x = (startPositions[idx].x + positionDiff.x) / this.scale.x;
                        point.y = (startPositions[idx].y + positionDiff.y) / this.scale.y;
                    })
                },
                () => {
                    store.dispatch(updatePoints({
                        sampleId: this.owner.reduxState.app.sampleIds[this.owner.reduxState.app.sampleIndex],
                        annotationIndex: this.drawerIndex,
                        points: this.annotation.points
                    }))
                })
            }
            else
            {
                this.owner.setAnnotationIndex(this.drawerIndex);
            }
            e.stopPropagation();
        })

        // Control points and reshaping
        this.controlPointIds = this.annotation.points.map((c, pointIdx) => {
            const id = generateHitId();

            
            this.bindHitEvent(id,"mousedown", (mouseDownEvent) => {
                const point = this.annotation.points[pointIdx];

                console.log("Control point hit", this.annotation.points[pointIdx])
                const startPosition: Vector2D = {
                    x: point.x *  this.scale.x,
                    y: point.y * this.scale.y
                }

                const positionDiff: Vector2D = {
                    x: 0,
                    y: 0
                }

                watchMouseMovement((mouseMoveEvent) => {
                    //const { scaleX: x, scaleY: y } = drawable.scale
                    positionDiff.x += mouseMoveEvent.movementX;
                    positionDiff.y += mouseMoveEvent.movementY;

                    point.x = (startPosition.x + positionDiff.x) / this.scale.x;
                    point.y = (startPosition.y + positionDiff.y) / this.scale.y;

                    console.log("Moving Control point")
                },() => {
                    store.dispatch(updatePoints({
                        sampleId: this.owner.reduxState.app.sampleIds[this.owner.reduxState.app.sampleIndex],
                        annotationIndex: this.drawerIndex,
                        points: [
                            point
                        ]
                    }))
                })

                mouseDownEvent.stopPropagation();
            })

            return id;
        })
    }

    override draw(data: ILabelerDrawData<CanvasRenderingContext2D>): void {
        const { ctx } = data;

        const originalPoints = this.annotation.points;

        const points: Vector2D[] = [{
            x: originalPoints[0].x,
            y: originalPoints[0].y
        },{
            x: originalPoints[1].x,
            y: originalPoints[0].y
        },{
            x: originalPoints[1].x,
            y: originalPoints[1].y
        },{
            x: originalPoints[0].x,
            y: originalPoints[1].y
        }];
        

        this.drawPolygon(ctx,points,(a) => ({x: a.x * this.scale.x, y: a.y * this.scale.y}),"red",false,true,1);

        if (this.isSelected) {
            for (const point of originalPoints) {
                this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,4,"white",1,"black")
            }
        }

        if(window.debugHitTest){
            const fillColor = `rgba(${this.drawableHitId},0.3)`;

            this.drawPolygon(ctx,points,(a) => ({x: a.x * this.scale.x, y: a.y * this.scale.y}),fillColor,true,true,1);

            if (this.isSelected) {
                for (let i = 0; i < this.annotation.points.length; i++) {
                    const point = this.annotation.points[i];
                    const hitId = this.controlPointIds[i];

                    this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,5,`rgb(${hitId})`)
                }
            }
        }
    }

    override drawBounds(data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>): void {
        const { ctx } = data;

        const originalPoints = this.annotation.points;

        const points: Vector2D[] = [{
            x: originalPoints[0].x,
            y: originalPoints[0].y
        },{
            x: originalPoints[1].x,
            y: originalPoints[0].y
        },{
            x: originalPoints[1].x,
            y: originalPoints[1].y
        },{
            x: originalPoints[0].x,
            y: originalPoints[1].y
        }];

        const fillColor = `rgb(${this.drawableHitId})`;

        this.drawPolygon(ctx,points,(a) => ({x: a.x * this.scale.x, y: a.y * this.scale.y}),fillColor,true,true,1);
        
    }

    override drawControlPointBounds(
        data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>
    ) {

        const { ctx } = data;

        const originalPoints = this.annotation.points;

        for (let i = 0; i < originalPoints.length; i++) {
            const point = originalPoints[i];
            const hitId = this.controlPointIds[i];

            this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,5,`rgb(${hitId})`)
        }
    }
}

class SegmentationDrawable extends Drawable {
    
    override onCreate(): void {

        // Selection And Dragging
        this.bindHitEvent(this.drawableHitId,"mousedown", (e) => {
            
            if(this.isSelected){
                const startPositions: Vector2D[] = this.annotation.points.map(c => ({
                    x: c.x *  this.scale.x,
                    y: c.y * this.scale.y
                }))

                const positionDiff: Vector2D = {
                    x: 0,
                    y: 0
                }

                watchMouseMovement((mouseMoveEvent) => {
                    //const { scaleX: x, scaleY: y } = drawable.scale
                    positionDiff.x += mouseMoveEvent.movementX;
                    positionDiff.y += mouseMoveEvent.movementY;

                    

                    this.annotation.points.forEach((point,idx) => {
                        point.x = (startPositions[idx].x + positionDiff.x) / this.scale.x;
                        point.y = (startPositions[idx].y + positionDiff.y) / this.scale.y;
                    })
                },
                () => {
                    store.dispatch(updatePoints({
                        sampleId: this.owner.reduxState.app.sampleIds[this.owner.reduxState.app.sampleIndex],
                        annotationIndex: this.drawerIndex,
                        points: this.annotation.points
                    }))
                })
            }
            else
            {
                this.owner.setAnnotationIndex(this.drawerIndex);
            }
            e.stopPropagation();
        })

        // Control points and reshaping
        this.controlPointIds = this.annotation.points.map((c, pointIdx) => {
            const id = generateHitId();

            
            this.bindHitEvent(id,"mousedown", (mouseDownEvent) => {
                const point = this.annotation.points[pointIdx];

                console.log("Control point hit", this.annotation.points[pointIdx])
                const startPosition: Vector2D = {
                    x: point.x *  this.scale.x,
                    y: point.y * this.scale.y
                }

                const positionDiff: Vector2D = {
                    x: 0,
                    y: 0
                }

                watchMouseMovement((mouseMoveEvent) => {
                    //const { scaleX: x, scaleY: y } = drawable.scale
                    positionDiff.x += mouseMoveEvent.movementX;
                    positionDiff.y += mouseMoveEvent.movementY;

                    point.x = (startPosition.x + positionDiff.x) / this.scale.x;
                    point.y = (startPosition.y + positionDiff.y) / this.scale.y;

                    console.log("Moving Control point")
                },() => {
                    store.dispatch(updatePoints({
                        sampleId: this.owner.reduxState.app.sampleIds[this.owner.reduxState.app.sampleIndex],
                        annotationIndex: this.drawerIndex,
                        points: [
                            point
                        ]
                    }))
                })

                mouseDownEvent.stopPropagation();
            })

            return id;
        })
    }


    override draw(data: ILabelerDrawData<CanvasRenderingContext2D>): void {
        const { ctx } = data;

        this.drawPolygon(ctx,this.annotation.points,(a) => ({x: a.x * this.scale.x, y: a.y * this.scale.y}),"red",false,true,1);

        if (this.isSelected) {
            for (const point of this.annotation.points) {
                this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,4,"white",1,"black")
            }
        }

        if(window.debugHitTest){
            const fillColor = `rgba(${this.drawableHitId},0.3)`;

            this.drawPolygon(ctx,this.annotation.points,(a) => ({x: a.x * this.scale.x, y: a.y * this.scale.y}),fillColor,true,true,1);

            if (this.isSelected) {
                for (let i = 0; i < this.annotation.points.length; i++) {
                    const point = this.annotation.points[i];
                    const hitId = this.controlPointIds[i];

                    this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,5,`rgb(${hitId})`)
                }
            }
        }
    }

    override drawBounds(data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>): void {
        const { ctx } = data;

        const fillColor = `rgb(${this.drawableHitId})`;

        this.drawPolygon(ctx,this.annotation.points,(a) => ({x: a.x * this.scale.x, y: a.y * this.scale.y}),fillColor,true,true,1);

        if (this.isSelected) {
            for (let i = 0; i < this.annotation.points.length; i++) {
                const point = this.annotation.points[i];
                const hitId = this.controlPointIds[i];

                this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,5,`rgb(${hitId})`)
            }
        }
    }

    override drawControlPointBounds(
        data: ILabelerDrawData<OffscreenCanvasRenderingContext2D>
    ) {

        const { ctx } = data;

        for (let i = 0; i < this.annotation.points.length; i++) {
            const point = this.annotation.points[i];
            const hitId = this.controlPointIds[i];

            this.drawControlPoint(ctx,point.x * this.scale.x, point.y * this.scale.y,5,`rgb(${hitId})`)
        }
    }
}


export default class LabelerController extends CanvasController<CanvasRenderingContext2D> {
    config: ILabelerControllerConfig;
    drawers: Drawable[] = [];
    annotations: IDatabaseAnnotation<IDatabasePoint[]>[] = [];
    reduxState: ReturnType<typeof store.getState> = store.getState();
    lastDrawTime: DOMHighResTimeStamp = 0;
    endCallbacks: (() => void)[] = []
    isActive = false;
    cavasCtx: CanvasRenderingContext2D | null = null;
    hitTestCanvasCtx: OffscreenCanvasRenderingContext2D | null = null;
    selectedControlPoint = -1
    mouseEventCallbacks: Map<BindableMouseEvents, {
        listener: (event: MouseEvent) => void;
        callbacks: Map<string, HitTestCallback>;
    }> = new Map();


    constructor(config: ILabelerControllerConfig) {
        super();
        this.config = config;
    }

    bindHitEvent(hitId: string,event: BindableMouseEvents, eventCallback: HitTestCallback): HitUnbind {

        if (this.cavasCtx === null) throw new Error("Canvas Ctx is not valid");

        if (!this.mouseEventCallbacks.has(event)) this.mouseEventCallbacks.set(event, {
            listener: ((eventName: BindableMouseEvents, event: MouseEvent) => {
                if (this.hitTestCanvasCtx !== null) {
                    const [r, g, b, a] = this.hitTestCanvasCtx.getImageData(event.offsetX, event.offsetY, 1, 1).data

                    if (a === 0) return;

                    const hitIdDetected = `${r},${g},${b}`

                    const callback = this.mouseEventCallbacks.get(eventName)?.callbacks.get(hitIdDetected)

                    if (callback !== undefined) {
                        callback(event);
                    }
                    else {
                        console.log("click color id", hitIdDetected);
                    }
                }

            }).bind(this, event),
            callbacks: new Map()
        })

        this.mouseEventCallbacks.get(event)?.callbacks.set(hitId, eventCallback)

        const mouseEventCallback = this.mouseEventCallbacks.get(event)

        if (mouseEventCallback) {
            this.cavasCtx?.canvas.addEventListener(event, mouseEventCallback.listener)
        }

        return () => {
            this.mouseEventCallbacks.get(event)?.callbacks.delete(hitId);

            const callbacksLength = this.mouseEventCallbacks.get(event)?.callbacks.size

            const listener = this.mouseEventCallbacks.get(event)?.listener

            if (listener !== undefined && callbacksLength !== undefined && callbacksLength !== 0) {
                this.cavasCtx?.canvas.removeEventListener(event, listener);

                this.mouseEventCallbacks.delete(event);
            }

        }
    }

    setAnnotationIndex(idx: number) {
        store.dispatch(setCurrentAnnotationIndex(idx));
    }

    override onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
        this.cavasCtx = data.ctx
        data.ctx.canvas.width = this.config.renderWidth;
        data.ctx.canvas.height = this.config.renderHeight;
        this.hitTestCanvasCtx = new OffscreenCanvas(data.ctx.canvas.width, data.ctx.canvas.height).getContext('2d', {
            willReadFrequently: true
        });

        // Debug function for viewing the collision canvas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).exportCollisionCanvas = async () => {
            const blob = await this.hitTestCanvasCtx?.canvas.convertToBlob()
            if(blob !== undefined){
                return await blobToBase64(blob);
            }
            return undefined;
        }

        const reduxStoreSubCallback = () => {

            this.reduxState = store.getState();

            const currentSample =
                this.reduxState.app.loadedSamples[this.reduxState.app.sampleIds[this.reduxState.app.sampleIndex]];

            const annotations = currentSample?.annotations ?? [];

            this.selectedControlPoint = this.reduxState.app.selectedAnnotationIndex;

            if (this.shouldReplaceDrawers(annotations)) {
                this.createDrawers(JSON.parse(JSON.stringify(annotations)))
            }

        }

        this.endCallbacks.push(store.subscribe(reduxStoreSubCallback))

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

        requestAnimationFrame(animationFrameCallback);

        reduxStoreSubCallback();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override onEnd(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
        this.cavasCtx = null;
        this.endCallbacks.forEach(c => c())
    }

    override getContext(
        canvas: HTMLCanvasElement
    ): CanvasRenderingContext2D | null {
        return canvas.getContext("2d");
    }

    createDrawers(annotations: IDatabaseAnnotation<IDatabasePoint[]>[]) {
        this.drawers.map(c => c.onDestroy());
        this.drawers = [];

        const [scaleX, scaleY] = [
            this.reduxState.app.labelerRect.width / this.reduxState.app.sampleImageInfo.width,
            this.reduxState.app.labelerRect.height / this.reduxState.app.sampleImageInfo.height,
        ];

        this.drawers = annotations.map((a, idx) => {

            const drawer = a.type === ELabelType.BOX ? new BoxDrawable(this, clone(a), idx,{
                x: scaleX,
                y: scaleY
            },this.reduxState.app.sampleScale) : new SegmentationDrawable(this, clone(a), idx,{
                x: scaleX,
                y: scaleY
            },this.reduxState.app.sampleScale)
            drawer.onCreate();
            return drawer;
        })

        this.annotations = clone(annotations);
    }

    shouldReplaceDrawers(annotations: IDatabaseAnnotation<IDatabasePoint[]>[]) {
        if (annotations.length !== this.annotations.length) {
            console.log("Creating new drawers because the number annotations have changed")
            return true;
        }

        for (let i = 0; i < annotations.length; i++) {
            const reduxAnnotation = annotations[i];
            const myAnnotation = this.annotations[i];

            if (reduxAnnotation.id !== myAnnotation.id || reduxAnnotation.points.length !== myAnnotation.points.length) {
                console.log("Creating new drawers because the annotation with id",reduxAnnotation.id,"has changed")
                return true;
            }

            if (JSON.stringify(reduxAnnotation.points) !== JSON.stringify(myAnnotation.points)) {
                console.log("Creating new drawers because the points of the annotation with id",reduxAnnotation.id,"Have changed",reduxAnnotation.points)
                return true;
            }
        }

        return false;
    }

    override draw(data: ILabelerDrawData<CanvasRenderingContext2D>): void {

        // const delta = data.step - this.lastDrawTime;

        const currentSample = this.reduxState.app.loadedSamples[this.reduxState.app.sampleIds[this.reduxState.app.sampleIndex]];

        if (currentSample === undefined) {
            return;
        }

        const { ctx } = data;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        this.hitTestCanvasCtx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)


        const boundsDrawData: ILabelerDrawData<OffscreenCanvasRenderingContext2D> | undefined = this.hitTestCanvasCtx !== null ? {
            ...data,
            ctx: this.hitTestCanvasCtx 
        } : undefined

        for (const drawable of this.drawers) {
            drawable.draw(data);

            if (boundsDrawData !== undefined) {
                drawable.drawBounds(boundsDrawData)
            }
        }

        // Draw control point bounds last so they can always be clicked
        if(boundsDrawData !== undefined && this.selectedControlPoint !== -1 && this.selectedControlPoint < this.drawers.length){
            this.drawers[this.selectedControlPoint].drawControlPointBounds(boundsDrawData);
        }
    }
}