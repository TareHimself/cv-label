import { CanvasController, ICanvasDrawData, ICanvasPrepData, RenderingContextType } from "@frontend/canvas";


type IEditorCanvasDrawData<ContextType extends RenderingContextType> = ICanvasDrawData<ContextType>;

export default class EditorCanvas extends CanvasController<CanvasRenderingContext2D> {
    override onBegin(data: ICanvasPrepData<CanvasRenderingContext2D>){
        /** */
      }
    
    override onEnd(data: ICanvasPrepData<CanvasRenderingContext2D>){
        /** */
    }
    
    override getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
        return canvas.getContext('2d');
    }
    
    override draw(data: IEditorCanvasDrawData<CanvasRenderingContext2D>){
        throw new Error("Draw Not Implemented For Controller");
      }
}