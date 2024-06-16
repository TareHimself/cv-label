import { ComputerVisionExporter } from ".";
import path from "path";
import fs from "fs/promises";
import { getProjectsPath } from '@root/utils';
import { createOrOpenProjectDatabase } from "../db";
import { ELabelType, IDatabaseSample } from "@types";


export class Yolov8Exporter extends ComputerVisionExporter {
    constructor(){
        super('YoloV8')
    }


    async writeData(projectPath: string,outputPath: string,category: "train" | "test" | "valid", samples: IDatabaseSample[]){
        const imagesDir = path.join(outputPath,"images",category);
        const labelsDir = path.join(outputPath,"labels",category);
        await fs.mkdir(imagesDir,{
            recursive: true,
        });
        await fs.mkdir(labelsDir,{
            recursive: true,
        });

        await Promise.allSettled(samples.map(c => fs.copyFile(path.join(projectPath,"images",c.id),path.join(imagesDir,`${c.id}.png`))));
        await Promise.allSettled(samples.map(async c => {
            const textFilePath = path.join(labelsDir,`${c.id}.txt`);

            await fs.writeFile(textFilePath,c.annotations.map((a) => {
                if(a.type === ELabelType.BOX){
                    const p1 = a.points[0];
                    const p2 = a.points[1];
                    const widgthHeight = [(p2.x - p1.x) / c.width,(p2.y - p1.y) / c.height];
                    const center = [(p1.x / c.width) + widgthHeight[0],(p1.y / c.height) + widgthHeight[1]];
                    return `${a.class} ${center[0]} ${center[1]} ${widgthHeight[0]} ${widgthHeight[1]}`
                }
                else
                {
                    const position = a.points.map(point => `${point.x / c.width} ${point.y / c.height}`).join(' ');
                    return `${a.class} ${position}`;
                }
            }).join('\n'))
        }));
    }

    override async export(projectId: string, projectPath: string): Promise<number> {
        console.log("Exporting samples from project with id",projectId, "at path",projectPath);
        const db = await createOrOpenProjectDatabase(projectPath);
        const samples = await db.getSamples();

        if(samples == undefined) return 0;

        // Uses 70 / 20 / 10 split
        const trainSplit = 0.7;
        const validSplit = 0.2;
        const testSplit = 0.1;

        const outputDir = path.join(projectPath,"exports","foo");

        const trainSamples = samples.splice(0,Math.floor(samples.length * trainSplit));
        const validSamples = samples.splice(0,Math.floor(samples.length * (validSplit / (validSplit + testSplit))))
        const testSamples = samples;

        await this.writeData(projectPath,outputDir,"train",trainSamples);
        await this.writeData(projectPath,outputDir,"valid",validSamples);
        await this.writeData(projectPath,outputDir,"test",testSamples);
        return trainSamples.length + validSamples.length + testSamples.length;
    }
}