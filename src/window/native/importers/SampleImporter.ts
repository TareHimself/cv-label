import { IDatabaseImage, INewSample, IPluginOption,  PluginOptionResultMap } from "@types";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from 'fs/promises'
// import { xxh64 } from "@node-rs/xxhash";
import sharp from "sharp";
import { IActiveProject } from "../project";
import { forEachAsync, sha512 } from "@root/utils";


export abstract class SampleImporter {

  options: IPluginOption[] = []

  abstract getName(): string
  abstract getId(): string
  abstract getOptions(): IPluginOption[]

  async importIntoProject(project: IActiveProject, options: PluginOptionResultMap,progressCallack: (current: number,total: number) => void): Promise<string[]> {
    const imported = await this.import(options);

    let total = imported.length;

    let importedNum = 0;

    const database = project.db
    const importedImages: { [key: string]: IDatabaseImage | undefined } = {}
    const result: string[] = []
    await forEachAsync(imported,async (data) => {
      try {
        const baseName = path.basename(data.path)
        let extension = path.extname(baseName)
        const name = baseName.slice(0,baseName.length - extension.length)

        let image: IDatabaseImage
        if (importedImages[data.path] !== undefined) {
          image = importedImages[data.path] as IDatabaseImage
        }
        else {
          const sampleMeta = await sharp(data.path).metadata();
          const hash = await sha512(data.path)
          

          if(extension.startsWith('.')) extension = extension.slice(1)

          extension = extension || 'png'
          const id = `${hash}.${extension}`

          const fromDb = await database.getImage(id)
          
          if (fromDb !== undefined) {
            image = fromDb
          }
          else {
            image = {
              id: id,
              width: sampleMeta.width ?? 0,
              height: sampleMeta.height ?? 0,
              extension: extension
            }
            if (await database.createImage(image)) {
              await fs.copyFile(data.path,path.join(project.imagesPath, image.id))
            }
            else {
              throw new Error("Failed to create image")
            }
          }
          importedImages[data.path] = image
        }

        const sampleId = uuidv4()
        if (!database.createSample({
          id: sampleId,
          name: name,
          imageId: image.id,
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

        importedNum++;

        progressCallack(importedNum,total)

        console.log("Imported", importedNum, "/", total)

        result.push(sampleId)
      } catch (error) {
        console.error(error);
        total--;

        progressCallack(importedNum,total)

        console.log("Imported", importedNum, "/", total)
      }
    },10)

    return result
    // return await Promise.allSettled(imported.map(async (data) => {
      
    // })).then(c => c.filter(a => a.status === 'fulfilled' && a.value.length > 0).map(a => a.status === 'fulfilled' ? a.value : ""))
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async import(options: PluginOptionResultMap): Promise<INewSample[]> {
    throw new Error("Importer not implemented");
  }
}
