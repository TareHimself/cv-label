import { openDatabase } from "../database"
import { v4 as uuidv4 } from "uuid";
import path from 'path'
import fs from 'fs/promises'
import { fileExists, getProjectsPath } from "@root/utils";
import { IDatabaseInstance, IProject } from "@types";
export interface IActiveProject {
    info: IProject
    db: IDatabaseInstance
    path: string
    imagesPath: string
}


let activeProject: IActiveProject | undefined = undefined



export function getImagesPath(projectId: string) {
    return path.join(getProjectsPath(), projectId, "images")
}

export function getImagePath(projectId: string,imageId: string) {
    return path.join(getImagesPath(projectId),imageId)
}

export async function activateProject(projectId: string) {
    try {

        const projectPath = path.join(getProjectsPath(), projectId)
        const projectInfoFilePath = path.join(projectPath, "info.cvl")

        if (!(await fileExists(projectInfoFilePath))) return undefined

        const database = await openDatabase(projectId)

        if (database === undefined) return undefined

        const imagesPath = getImagesPath(projectId)

        await fs.mkdir(imagesPath, {
            recursive: true,
        });

        const projectInfo = JSON.parse(await fs.readFile(projectInfoFilePath, { encoding: 'utf-8' })) as IProject

        const result: IActiveProject = {
            info: projectInfo,
            db: database,
            path: projectPath,
            imagesPath: imagesPath
        }

        if (activeProject !== undefined) {
            activeProject.db.close()
        }

        activeProject = result

        return result
    } catch (error) {
        console.error(error);
    }

    return undefined
}

export async function createProject(name: string) {
    try {
        const projectId = uuidv4().replace(/-/g, "");
        const projectPath = path.join(getProjectsPath(), projectId)
        await fs.mkdir(projectPath, {
            recursive: true,
        });

        const imagesPath = getImagesPath(projectId)

        await fs.mkdir(imagesPath, {
            recursive: true,
        });

        const projectInfo: IProject = {
            id: projectId,
            name
        }

        await fs.writeFile(path.join(projectPath, "info.cvl"), JSON.stringify(projectInfo));

        return projectInfo;
    } catch (error) {
        console.error(error);
    }

    return undefined;
}

export function getActiveProject(): IActiveProject | undefined {
    return activeProject;
}


async function loadProjectInfo(projectId: string): Promise<IProject | undefined>{
    const projectFilePath = path.join(getProjectsPath(),projectId,"info.cvl")
    if(!(await fileExists(projectFilePath))) return undefined
    return JSON.parse(await fs.readFile(projectFilePath,{ encoding: 'utf8'}))
}
export async function getProjects() {
    try {
        
        const fileNames = await fs.readdir(getProjectsPath(), {
            recursive: false
        })

        const projectInfos = (await Promise.all(fileNames.map(loadProjectInfo))).filter(c => c !== undefined)
        
        return projectInfos;
    } catch (error) {
        console.error(error);
    }

    return [];
}