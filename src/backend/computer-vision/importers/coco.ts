import { dialog } from "electron";
import { ComputerVisionImporter } from ".";
import { CvAnnotation, CvSegmentAnnotation, ELabelType, ISample } from "@types";
import { withNodeWorker } from "@root/backend/worker";
import { sqliteNow as sqliteNowMain } from "@root/utils";
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
  override async import(): Promise<ISample[]> {
    const dialogResult = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (dialogResult.filePaths.length === 0) {
      return [];
    }

    const datasetPath = dialogResult.filePaths[0];

    return await withNodeWorker(
      async (datasetPath, segmentLabelType, nowFunctAsString) => {
        const [fs, path] = eval(`[require('fs'),require('path')]`) as [
          typeof import("fs"),
          typeof import("path")
        ];

        const sqliteNowProxy: typeof sqliteNowMain = eval(nowFunctAsString);

        const immediateFolders = await fs.promises.readdir(datasetPath);
        const allSamples: ISample[] = [];

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

            // const categoriesLookup = dataset.categories.reduce((t, c) => {
            //   t[c.id] = c;

            //   return t;
            // }, {} as Record<string, ICocoDataset["categories"][0]>);

            const samples: ISample[] = dataset.images.map((img) => {
              return {
                path: path.join(datasetPath, folder, img.file_name),
                labels: dataset.annotations
                  .filter((a) => a.image_id === img.id)
                  .reduce((t, c) => {
                    t.push(
                      ...c.segmentation.map((d) => {
                        const points: [number, number][] = [];

                        for (let i = 0; i < d.length; i += 2) {
                          points.push(d.slice(i, i + 2) as [number, number]);
                        }

                        const label: CvSegmentAnnotation = {
                          points: points,
                          classIndex: c.category_id,
                          type: segmentLabelType as ELabelType.SEGMENT,
                        };

                        return label;
                      })
                    );

                    return t;
                  }, [] as CvAnnotation[]),
                added: sqliteNowProxy(),
              };
            });

            allSamples.push(...samples);
          } catch (error) {
            console.error(error);
          }
        }

        return allSamples;
      },
      datasetPath,
      ELabelType.SEGMENT,
      sqliteNowMain.toString()
    );
  }
}
