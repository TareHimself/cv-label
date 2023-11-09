import React, { useEffect, useId } from 'react'

export interface ICanvasRenderData<ContextType extends RenderingContext> {
  canvas: HTMLCanvasElement;
  ctx: ContextType;
  step: DOMHighResTimeStamp;
}

export type CanvasProps<ContextType extends RenderingContext = RenderingContext> = {
  render: (data: ICanvasRenderData<ContextType>) => void;
  width: React.CSSProperties['width']
  height: React.CSSProperties['height']
  id?: string;
  getContext: (canvas: HTMLCanvasElement) => ContextType | null
}

export default function Canvas<ContextType extends RenderingContext>(props: CanvasProps<ContextType>) {

  const generatedId = useId();

  const canvasId = props.id ?? generatedId;
  const { getContext, render } = props

  useEffect(() => {
    const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (canvasElement) {
      // canvasElement.width = editorRect.width;
      // canvasElement.height = editorRect.height;

      const ctx = getContext(canvasElement);
      let isActive = true;

      if (ctx) {
        const callback = (step: DOMHighResTimeStamp) => {
          render({
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
        };
      }
    }
  }, [canvasId, getContext, render]);

  return (
    <canvas
      id={canvasId}
      style={{
        width: props.width,
        height: props.height,
      }}
    ></canvas>
  )
}
