import path from 'path';
import { v4 as uuidv4 } from "uuid";
import { ELabelType, IDatabaseAnnotation, IDatabasePoint, IDatabaseSample, IDatabaseSampleList, IdFieldUpdate } from "@types";
import * as fs from 'fs';
import { getProjectsPath } from "@root/utils";
import Realm, { ObjectSchema } from "realm";



export class DatabasePoint extends Realm.Object<IDatabasePoint>{
    declare id: string;
    declare x: number;
    declare y: number;
    static schema: ObjectSchema = {
        name: "DatabasePoint",
        properties: {
            id: "string",
            x: "float",
            y: "float"
        },
        primaryKey: "id",
    };
}



export class DatabaseAnnotation extends Realm.Object<IDatabaseAnnotation<IDatabasePoint[]>> {
    declare id: string;
    declare type: ELabelType;
    declare class: number;
    declare points: IDatabasePoint[];
    static schema: ObjectSchema = {
        name: "DatabaseAnnotation",
        properties: {
            id: "string",
            type: "int",
            class: "int",
            points: {
                type: "list",
                objectType: "DatabasePoint", // this could also be a Realm object:
                optional: false, //null values are not allowed
            },
        },
        primaryKey: "id",
    };
}

export class DatabaseSample extends Realm.Object<IDatabaseSample<IDatabaseAnnotation[]>> {
    declare id: string;
    declare annotations: IDatabaseAnnotation<IDatabasePoint[]>[];
    //declare createdAt: string;
    static schema: ObjectSchema = {
        name: "DatabaseSample",
        properties: {
            id: "string",
            annotations: {
                type: "list",
                objectType: "DatabaseAnnotation", // this could also be a Realm object:
                optional: false, //null values are not allowed
            },
        },
        primaryKey: "id",
    };
}

export class DatabaseSampleList extends Realm.Object<IDatabaseSampleList> {
    declare id: number;
    declare samples: string[];
    // declare createdAt: string;
    static schema: ObjectSchema = {
        name: "DatabaseSampleList",
        properties: {
            id: "int",
            samples: "string[]"
        },
        primaryKey: "id",
    };
}


export interface IActiveProject {
    info: Realm;
    path: string
}

let activeProject: IActiveProject | undefined = undefined;

export function getActiveProject() {
    return activeProject;
}

export async function createOrOpenProject(projectPath: string) {

    if (activeProject) {
        if (activeProject.path === projectPath) {
            return
        }

        activeProject.info.close();
    }

    const realm = await Realm.open({
        schema: [DatabasePoint, DatabaseAnnotation, DatabaseSample, DatabaseSampleList],
        path: path.join(projectPath, "realm", "db")
    });
    activeProject = {
        info: realm,
        path: projectPath
    }

    return;
}

type FindSampleByPkResult = IDatabaseSample<IDatabaseAnnotation<IDatabasePoint[]>[]>;

export async function findSampleByPk(sampleId: string): Promise<FindSampleByPkResult | undefined> {
    if (!activeProject || !sampleId) {
        return undefined;
    }
    const data = activeProject.info.objectForPrimaryKey(DatabaseSample, sampleId);
    return (data?.toJSON() as unknown as FindSampleByPkResult | null) ?? undefined;
}

export function createSample(data: IDatabaseSample<IDatabaseAnnotation<IDatabasePoint[]>[]>): boolean {
    if (!activeProject) {
        return false;
    }

    try {
        const realm = activeProject.info;

        realm.write(() => {
            const listData = realm.objectForPrimaryKey(DatabaseSampleList, 0) ?? realm.create(DatabaseSampleList, {
                id: 0,
                samples: []
            })

            listData.samples.push(data.id);

            realm.create(DatabaseSample, data);
        })
        return true;
    } catch (error) {
        console.error(error)
        return false;
    }
}

export async function createSampleAnnotationsByPk(sampleId: string, annotations: IDatabaseAnnotation<IDatabasePoint[]>[]) {
    if (!activeProject) {
        return false;
    }

    try {
        const sample = activeProject.info.objectForPrimaryKey(DatabaseSample, sampleId);
        if (!sample) return false;

        const realm = activeProject.info;
        realm.write(() => {
            sample.annotations.push(...annotations);
        })
        return true;
    } catch (error) {
        console.error(error)
        return false;
    }

}

export async function updateSampleAnnotationsByPk(sampleId: string, annotations: IdFieldUpdate<IDatabaseAnnotation<IDatabasePoint[]>>[]) {
    if (!activeProject) {
        return false;
    }

    try {
        const realm = activeProject.info;
        realm.write(() => {
            annotations.forEach((ann) => {
                const annFromDb = realm.objectForPrimaryKey(DatabaseAnnotation, ann.id)
                if (annFromDb != null) {
                    const annKeys = Object.keys(ann);
                    for (const annKey of annKeys) {
                        if (annKey !== 'id' && annFromDb[annKey] !== undefined) {
                            (annFromDb[annKey] as unknown) = ann[annKey] as unknown;
                        }
                    }
                }

            })
        })
        return true;
    } catch (error) {
        console.error(error)
        return false;
    }
}

export async function updatePointsByPk(points: IdFieldUpdate<IDatabasePoint>[]): Promise<boolean> {
    if (!activeProject) {
        return false;
    }

    try {
        const realm = activeProject.info;
        realm.write(() => {
            points.forEach((pt) => {
                const ptFromDb = realm.objectForPrimaryKey(DatabasePoint, pt.id)
                if (ptFromDb != null) {
                    const ptKeys = Object.keys(pt);
                    for (const ptKey of ptKeys) {
                        if (ptKey !== 'id' && ptFromDb[ptKey] !== undefined) {
                            (ptFromDb[ptKey] as unknown) = pt[ptKey] as unknown;
                        }
                    }
                }

            })
        })
        return true;
    } catch (error) {
        console.error(error)
        return false;
    }
}

export async function removeSampleAnnotationsByPk(sampleId: string, annotations: string[]) {
    // await DatabaseAnnotation.destroy({
    //     where: {
    //         id: annotations
    //     }
    // })
}


window.ioBridge.handle("getSample", async (sampleId) => {
    try {
        return await findSampleByPk(sampleId)
    } catch (error) {
        console.error(error)
    }

    return undefined;
})

window.ioBridge.handle("getSampleIds", async () => {
    try {
        const realm = activeProject?.info;
        if (!realm) return [];

        return realm.objectForPrimaryKey(DatabaseSampleList, 0)?.toJSON().samples as string[] ?? []
    } catch (error) {
        console.error(error);
    }

    return [];
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.ioBridge.handle("createProject", async (_name) => {
    try {
        const projectId = uuidv4().replace(/-/g, "");
        const projectPath = path.join(getProjectsPath(), projectId)
        await fs.promises.mkdir(projectPath, {
            recursive: true,
        });

        await createOrOpenProject(projectPath)

        return projectId;
    } catch (error) {
        console.error(error);
    }

    return undefined;
});



window.ioBridge.handle("activateProject", async (projectId) => {
    try {
        const projectPath = path.join(getProjectsPath(), projectId)
        await createOrOpenProject(projectPath)
        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

window.ioBridge.handle("createAnnotations", async (sampleId, annotations) => {
    try {

        return await createSampleAnnotationsByPk(sampleId, annotations);
    } catch (error) {
        console.error(error);
    }

    return false;
})

window.ioBridge.handle("removeAnnotations", async (sampleId, annotations) => {
    try {
        await removeSampleAnnotationsByPk(sampleId, annotations)
        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

window.ioBridge.handle("createPoints", async (annotationId, points) => {
    try {

        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

window.ioBridge.handle("updatePoints", async (points) => {
    try {

        return await updatePointsByPk(points);
    } catch (error) {
        console.error(error);
    }

    return false;
})

window.ioBridge.handle("removePoints", async (sampleId, annotationId, points) => {
    try {

        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

