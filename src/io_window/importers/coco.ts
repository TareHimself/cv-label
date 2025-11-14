import { dialog } from "@electron/remote";
import { ComputerVisionImporter } from ".";
import { CvAnnotation, CvSegmentAnnotation, ELabelType, INewSample, IPluginInfo, PluginOption, PluginOptionResult, PluginOptionResultMap } from "@types";
import * as fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { withNodeWorker } from "@root/main/worker";
interface ICocoDataset {
  info: {
    year: string;
    version: string;
    description: string;
    url: string;
    date_created: string;
  };
  licenses: {
    id: number;
    url: string;
    name: string;
  }[];
  categories: {
    id: number;
    name: string;
    supercategory: string;
  }[];
  images: {
    id: number;
    license: number;
    file_name: string;
    height: number;
    width: number;
    date_captured: string;
  }[];
  annotations: {
    id: number;
    image_id: number;
    category_id: number;
    bbox: [number, number, number, number];
    area: number;
    segmentation: number[][];
    iscrowd: number;
  }[];
}
export class CocoSegmentationImporter extends ComputerVisionImporter {
  constructor() {
    super("Coco");
  }

  getOptions(): PluginOption[] {
    return [{
      id: "folder",
      displayName: "COCO Dataset Path",
      type: 'folderSelect',
      multiple: false
    }]
  }

  override async import(options: PluginOptionResultMap): Promise<INewSample[]> {
    const datasetPathOption = options["folder"] as (PluginOptionResult<'folderSelect'> | undefined)

    if(!datasetPathOption || datasetPathOption.type !== 'folderSelect' ||  !fs.existsSync(datasetPathOption.value[0])){
      return [];
    }

    const datasetPath = datasetPathOption.value[0];

        const immediateFolders = await fs.promises.readdir(datasetPath);
        const allSamples: INewSample[] = [];

        for (const folder of immediateFolders) {
          const annotationsPath = path.join(
            datasetPath,
            folder,
            "_annotations.coco.json"
          );

          try {
            const dataset: ICocoDataset = await fs.promises
              .readFile(annotationsPath, {
                encoding: "utf-8",
              })
              .then((a) => JSON.parse(a));

            const samples: INewSample[] = dataset.images.map((img) => {
              return {
                path: path.join(datasetPath, folder, img.file_name),
                annotations: dataset.annotations
                  .filter((a) => a.image_id === img.id)
                  .reduce((t, c) => {
                    t.push(
                      ...c.segmentation.map((d) => {
                        const points: INewSample['annotations'][0]['points'] = [];

                        for (let i = 0; i < d.length; i += 2) {
                          const point = d.slice(i, i + 2) as [number, number]
                          points.push({
                            id: uuidv4(),
                            x: point[0],
                            y: point[1]
                          });
                        }

                        const label: CvSegmentAnnotation = {
                          id: uuidv4(),
                          points: points,
                          class: c.category_id,
                          type: ELabelType.SEGMENT,
                        };

                        return label;
                      })
                    );

                    return t;
                  }, [] as CvAnnotation[]),
              };
            });

            allSamples.push(...samples);
          } catch (error) {
            console.error(error);
          }
        }

        return allSamples;
  }
}
