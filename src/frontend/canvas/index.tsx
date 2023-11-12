/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useId } from 'react'


export type CleanupFn = () => void;

export type RenderingContextType = (RenderingContext | OffscreenRenderingContext)

export interface ICanvasDrawData<ContextType extends RenderingContextType> {
  ctx: ContextType;
}

export interface ICanvasPrepData<ContextType extends RenderingContext> {
  ctx: ContextType;
}

export class CanvasController<ContextType extends RenderingContext = RenderingContext,DrawData extends ICanvasDrawData<ContextType> = ICanvasDrawData<ContextType>> {

  onBegin(data: ICanvasPrepData<ContextType>){
    /** */
  }

  onEnd(data: ICanvasPrepData<ContextType>){
    /** */
  }

  getContext(canvas: HTMLCanvasElement): ContextType | null {
    throw new Error("Get Context Not Implemented For Controller");
  }

  draw(data: DrawData){
    throw new Error("Draw Not Implemented For Controller");
  }
}

// class BasicCanvasController extends CanvasController<CanvasRenderingContext2D>{
//   isActive = false;
//   onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>){
//     this.isActive = true;

//     const callback = ((step: DOMHighResTimeStamp) => {
//       this.draw({
//         canvas: data.canvas,
//         ctx: data.ctx,
//         step: step
//       })

//       if(this.isActive){
//         requestAnimationFrame(callback);
//       }
//     }).bind(this)
    
//     requestAnimationFrame(callback);
//   }

//   onEnd(data: ICanvasPrepData<CanvasRenderingContext2D>): void {
//     this.isActive = false;
//   }
// }

export interface CanvasProps<ContextType extends RenderingContext = RenderingContext>{
  controller: CanvasController<ContextType>
  width: React.CSSProperties['width']
  height: React.CSSProperties['height']
  id?: string;
  onClick?: React.DOMAttributes<HTMLCanvasElement>['onClick'];
  style?: React.CSSProperties;
}
export default function Canvas<ContextType extends RenderingContext>(props: CanvasProps<ContextType>) {

  const generatedId = useId();

  const canvasId = props.id ?? generatedId;

  const { controller } = props

  useEffect(() => {
    const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (canvasElement) {
      // canvasElement.width = editorRect.width;
      // canvasElement.height = editorRect.height;

      const ctx = controller.getContext(canvasElement);
      

      if (ctx) {
        controller.onBegin({
          ctx: ctx,
        })

        return () => {
          controller.onEnd({
            ctx: ctx,
          })
        };
      }
    }
  }, [canvasId, controller]);

  return (
    <canvas
      id={canvasId}
      style={{...(props.style ?? {}),
        width: props.width,
        height: props.height,
      }}
      onClick={props.onClick}
    ></canvas>
  )
}
