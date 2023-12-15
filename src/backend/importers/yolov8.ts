import { ELabelType, INewSample } from "@types";
import { ComputerVisionImporter } from ".";
import { dialog } from "electron";
import { withNodeWorker } from "@root/backend/worker";

export class YoloV8Importer extends ComputerVisionImporter {
  constructor() {
    super("Yolov8");
  }

  override async import(): Promise<INewSample[]> {
    const dialogResult = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (dialogResult.filePaths.length === 0) {
      return [];
    }

    const datasetPath = dialogResult.filePaths[0];

    return await withNodeWorker(
      async (datasetPath, boxLabelType) => {
        const fs = __non_webpack_require__("fs");
        const path = __non_webpack_require__("path")
        const sharp = __non_webpack_require__("sharp")
        const uuid = __non_webpack_require__("uuid");

        const log = console.log.bind("[Yolov8 Importer]")
        
        log("Processing Yolov8 Dataset At Path",datasetPath)

        const immediateFolders = await fs.promises.readdir(datasetPath);

        const allSamples: INewSample[] = [];
        for (const folder of immediateFolders) {
          if (
            await fs.promises
              .stat(path.join(datasetPath, folder))
              .then((a) => !a.isDirectory())
          ) {
            continue;
          }

          const imagesPath = path.join(datasetPath, folder, "images");

          const labelsPath = path.join(datasetPath, folder, "labels");

          const images = await fs.promises.readdir(imagesPath);

          log("Proceccing images at path",imagesPath)

          const imageDims = await Promise.allSettled(
            images.map((a) =>
              sharp(path.join(imagesPath, a))
                .metadata()
                .then((b) => ({
                  file: a,
                  metadata: b,
                }))
            )
          ).then(
            (b) =>
              b
                .map((c) => {
                  if (c.status === "fulfilled") {
                    return c.value;
                  }

                  return undefined;
                })
                .filter((c) => c !== undefined) as {
                  file: string;
                  metadata: import("sharp").Metadata;
                }[]
          );

          const samples = await Promise.all(
            imageDims.map(async ({ file, metadata }) => {
              const imageFile = path.join(imagesPath, file);
              const labelPath = path.join(
                labelsPath,
                file.split(".").reverse().slice(1).reverse().join(".") + ".txt"
              );
              const height = metadata.height;
              const width = metadata.width;
              if (height && width) {
                try {
                  const labelFile = await fs.promises.readFile(labelPath, {
                    encoding: "utf-8",
                  });
                  const labels = labelFile
                    .trim()
                    .split("\n")
                    .map((c) => c.split(" ").map(parseFloat));
                  return {

                    path: imageFile,
                    annotations: labels.map(([cls, x, y, w, h]) => {
                      const x1 = x * width - (w * width) / 2;
                      const y1 = y * height - (h * height) / 2;
                      const x2 = x1 + w * width;
                      const y2 = y1 + h * height;
                      return {
                        id: uuid.v4(),
                        points: [{
                          id: uuid.v4(),
                          x: x1,
                          y: y1,

                        },
                        {
                          id: uuid.v4(),
                          x: x2,
                          y: y2,
                        }
                        ],
                        class: Math.floor(cls),
                        type: boxLabelType as ELabelType.BOX,
                      };
                    }),
                  } as INewSample;
                } catch (error) {
                  //   console.log(labelPath, error);
                  /* empty */
                }
              }

              return {
                path: imageFile,
                annotations: [],
              } as INewSample;
            })
          );

          allSamples.push(...samples);

          log("Processed",samples.length,"From Path",path.join(datasetPath,folder))
          log("Processed",allSamples.length,"Total Samples")
        }

        log("Processing Completed With",allSamples.length,"Samples");

        return allSamples;
      },
      datasetPath,
      ELabelType.BOX
    );
  }
}
