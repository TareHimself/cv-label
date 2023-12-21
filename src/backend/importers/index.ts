import { INewSample } from "@types";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { DatabaseAnnotation, DatabasePoint, DatabaseSample, DatabaseSampleOrder, createOrOpenProject, createSampleInsertionIndex, getActiveProject } from "@root/backend/db";
import * as fs from 'fs'
import { xxh64 } from '@node-rs/xxhash'
import { getProjectsPath } from "@root/utils";
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

    let total = imported.length;

    let importedNum = 0;

    return await Promise.allSettled(imported.map(async (data) => {
      try {
        const newName = xxh64(await fs.promises.readFile(data.path)).toString();

        const activeProject = getActiveProject();

        if(!activeProject) throw new Error("There is no active project");

        await activeProject.info.transaction(async ()=>{

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

          await DatabaseSampleOrder.create({
            id: newName,
            index: createSampleInsertionIndex()
          })

          await fs.promises.copyFile(data.path,path.join(projectPath,"images",newName));

          importedNum++;

          console.log("Imported",importedNum,"/",total)
        })
        
        return newName;
      } catch (error) {
        console.error(error);
        total--;
        
        console.log("Imported",importedNum,"/",total)
        throw error
      }
    })).then(c => c.filter(a => a.status === 'fulfilled' && a.value.length > 0).map(a => a.status === 'fulfilled' ? a.status : ""))
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async import(): Promise<INewSample[]> {
    throw new Error("Importer not implemented");
  }
}
