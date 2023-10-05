import { withNodeWorker } from "@root/backend/worker";
import { ISample } from "@types";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { getProjectsPath } from "@root/backend/utils";
export class ComputerVisionImporter {
  name: string;
  id: string;

  constructor(name: string) {
    this.name = name;
    this.id = uuidv4();
  }

  async importIntoProject(projectName: string): Promise<ISample[]> {
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

        return await Promise.allSettled(
          files.map(async (sample) => {
            try {
              const newName = path.join(
                projectPath,
                xxh64(await fs.promises.readFile(sample.path)).toString() +
                  "." +
                  path.basename(sample.path).split(".").reverse()[0]
              );

              await fs.promises.copyFile(sample.path, newName);

              return {
                path: newName,
                labels: sample.labels,
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
      path.join(getProjectsPath(), projectName),
      imported
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async import(): Promise<ISample[]> {
    throw new Error("Importer not implemented");
  }
}
