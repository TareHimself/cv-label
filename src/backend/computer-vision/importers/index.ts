import { withNodeWorker } from "@root/backend/worker";
import { ISample } from "@types";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { getProjectsPath } from "@root/backend/utils";
import { DatabaseImages, DatabaseSample, createOrOpenProject } from "@root/backend/db";
export class ComputerVisionImporter {
  name: string;
  id: string;

  constructor(name: string) {
    this.name = name;
    this.id = uuidv4();
  }

  async importIntoProject(projectId: string): Promise<ISample[]> {
    const imported = await this.import();

    return await withNodeWorker(
      async (projectPath, files) => {
        const [fs, path, { xxh64 }] = eval(
          `[require('fs'),require('path'),require('@node-rs/xxhash')]`
        ) as [
          typeof import("fs"),
          typeof import("path"),
          typeof import("@node-rs/xxhash")
        ];

        await fs.promises.mkdir(projectPath, {
          recursive: true,
        });

        await createOrOpenProject(projectPath)

        return await Promise.allSettled(
          files.map(async (sample) => {
            try {


              const newName = xxh64(await fs.promises.readFile(sample.path)).toString();

              DatabaseImages.create({
                id: newName,
                data: await fs.promises.readFile(sample.path)
              })

              const annotationsConverted = 
              await DatabaseSample.create({
                id: newName,
                annotations: 
              })

              return {
                path: newName,
                annotations: sample.annotations,
                added: sample.added,
              };
            } catch (error) {
              console.error(error);
              throw error;
            }
          })
        ).then((a) =>
          (
            a.filter(
              (b) => b.status === "fulfilled"
            ) as PromiseFulfilledResult<ISample>[]
          ).map((c) => c.value)
        );
      },
      path.join(getProjectsPath(), projectId),
      imported
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async import(): Promise<ISample[]> {
    throw new Error("Importer not implemented");
  }
}
