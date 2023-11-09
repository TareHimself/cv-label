import { INewSample } from "@types";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { getProjectsPath } from "@root/backend/utils";
import { DatabaseAnnotation, DatabasePoint, DatabaseSample, createOrOpenProject } from "@root/backend/db";
import * as fs from 'fs'
import { xxh64 } from '@node-rs/xxhash'
export class ComputerVisionImporter {
  name: string;
  id: string;

  constructor(name: string) {
    this.name = name;
    this.id = uuidv4();
  }

  async importIntoProject(projectId: string): Promise<string[]> {
    const imported = await this.import();

    const projectPath = path.join(getProjectsPath(), projectId);

    try{
      await fs.promises.mkdir(projectPath, {
        recursive: true,
      });
    }catch(e) {
      /** */
    }

    try{
      await fs.promises.mkdir(path.join(projectPath,'images'), {
        recursive: true,
      });
    }catch(e) {
      /** */
    }

    await createOrOpenProject(projectPath)

    return await Promise.all(imported.map(async (data) => {
      const newName = xxh64(await fs.promises.readFile(data.path)).toString();

      await fs.promises.copyFile(data.path,path.join(projectPath,"images",newName));

      try {

        const annotationIds = await Promise.all(data.annotations.map(async (ann) => {
          const annotationId = uuidv4();

          const pointIds = await Promise.all(ann.points.map(async (pt) => {
            const pointId = uuidv4();

            await DatabasePoint.create({
              id: pointId,
              x: pt.x,
              y: pt.y
            })

            return pointId
          }))

          await DatabaseAnnotation.create({
            id: annotationId,
            points: pointIds,
            type: ann.type,
            class: ann.class
          })

          return annotationId;
        }))

        await DatabaseSample.create({
          id: newName,
          annotations: annotationIds,
        })

        return newName;
      } catch (error) {
        console.error(error);
        return ""
      }
    })).then(c => c.filter(a => a.length > 0))
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async import(): Promise<INewSample[]> {
    throw new Error("Importer not implemented");
  }
}
