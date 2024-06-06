import { ComputerVisionExporter } from ".";


export class Yolov8Exporter extends ComputerVisionExporter {
    constructor(){
        super('YoloV8')
    }

    override async export(projectId: string, projectPath: string): Promise<number> {
        console.log("Exporting samples from project with id",projectId, "at path",projectPath);
        return 0;
    }
}