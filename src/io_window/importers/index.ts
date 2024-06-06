import { INewSample, PluginOption,  PluginOptionResultMap } from "@types";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { createOrOpenProjectDatabase, getActiveProject } from "@root/io_window/db";
import * as fs from 'fs'
//import { require as remoteRequire } from "@electron/remote";
import { getProjectsPath } from "@root/utils";
import { xxh64 } from "@node-rs/xxhash";
//const { xxh64 } = remoteRequire('@node-rs/xxhash') as typeof import('@node-rs/xxhash')
export class ComputerVisionImporter {
  name: string;
  id: string;

  constructor(name: string) {
    this.name = name;
    this.id = uuidv4();
  }

  getOptions(): PluginOption[]{
    return [];
  }

  async importIntoProject(projectId: string,options: PluginOptionResultMap): Promise<string[]> {
    const imported = await this.import(options);

    const projectPath = path.join(getProjectsPath(), projectId);

    try {
      await fs.promises.mkdir(projectPath, {
        recursive: true,
      });
    } catch (e) {
      /** */
    }

    try {
      await fs.promises.mkdir(path.join(projectPath, 'images'), {
        recursive: true,
      });
    } catch (e) {
      /** */
    }

    await createOrOpenProjectDatabase(projectPath)

    let total = imported.length;

    let importedNum = 0;

    return await Promise.allSettled(imported.map(async (data) => {
      try {
        const newName = xxh64(await fs.promises.readFile(data.path)).toString();

        const activeProject = getActiveProject();

        if (!activeProject) throw new Error("There is no active project");

        if (!activeProject.createSample({
          id: newName,
          annotations: data.annotations.map((ann) => {
            return {
              id: uuidv4(),
              type: ann.type,
              class: ann.class,
              points: ann.points.map((pt) => {
                return {
                  id: uuidv4(),
                  x: pt.x,
                  y: pt.y
                }
              })
            }
          })
        })) {
          throw new Error("Failed to add to database")
        }

        await fs.promises.copyFile(data.path, path.join(projectPath, "images", newName));

        importedNum++;

        console.log("Imported", importedNum, "/", total)

        return newName;
      } catch (error) {
        console.error(error);
        total--;

        console.log("Imported", importedNum, "/", total)
        throw error
      }
    })).then(c => c.filter(a => a.status === 'fulfilled' && a.value.length > 0).map(a => a.status === 'fulfilled' ? a.value : ""))
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async import(options: PluginOptionResultMap): Promise<INewSample[]> {
    throw new Error("Importer not implemented");
  }
}
