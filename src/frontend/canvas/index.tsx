/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useId } from 'react'

export interface ICanvasDrawData<ContextType extends RenderingContext> {
  canvas: HTMLCanvasElement;
  ctx: ContextType;
  step: DOMHighResTimeStamp;
}

export interface ICanvasPrepData<ContextType extends RenderingContext> {
  canvas: HTMLCanvasElement;
  ctx: ContextType;
}

export class CanvasController<ContextType extends RenderingContext = RenderingContext> {

  onBegin(data: ICanvasPrepData<ContextType>){
    /** */
  }

  onEnd(data: ICanvasPrepData<ContextType>){
    /** */
  }

  getContext(canvas: HTMLCanvasElement): ContextType | null {
    throw new Error("Get Context Not Implemented For Controller");
  }

  draw(data: ICanvasDrawData<ContextType>){
    throw new Error("Draw Not Implemented For Controller");
  }
}

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
      let isActive = true;

      if (ctx) {
        controller.onBegin({
          canvas: canvasElement,
          ctx: ctx,
        })

        
        const callback = (step: DOMHighResTimeStamp) => {
          controller.draw({
            canvas: canvasElement,
            ctx: ctx,
            step: step
          })

          if(isActive){
            requestAnimationFrame(callback);
          }
        }
        
        requestAnimationFrame(callback);
        
        return () => {
          isActive = false;
          controller.onEnd({
            canvas: canvasElement,
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
