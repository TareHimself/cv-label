import { ComputerVisionExporter } from ".";


export class Yolov8Exporter extends ComputerVisionExporter {
    constructor(){
        super('YoloV8')
    }

    override async export(projectId: string, projectPath: string): Promise<number> {
        return 0;
    }
}