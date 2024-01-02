import path from 'path';
import { v4 as uuidv4 } from "uuid";
import { ELabelType, IDatabaseAnnotation, IDatabasePoint, IDatabaseSample, IDatabaseSampleList, TUpdateWithId } from "@types";
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



export class DatabaseAnnotation extends Realm.Object<IDatabaseAnnotation> {
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
            points: "DatabasePoint[]",
        },
        primaryKey: "id",
    };
}

export class DatabaseSample extends Realm.Object<IDatabaseSample> {
    declare id: string;
    declare annotations: IDatabaseAnnotation[];
    //declare createdAt: string;
    static schema: ObjectSchema = {
        name: "DatabaseSample",
        properties: {
            id: "string",
            annotations: "DatabaseAnnotation[]",
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

function realmObjectToJson<T>(obj: Realm.Object<T> | null){
    if(!obj){
        return null
    }

    return obj.toJSON() as unknown as T
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

export async function findSampleByPk(sampleId: string): Promise<IDatabaseSample | undefined> {
    if (!activeProject || !sampleId) {
        return undefined;
    }
    const data = activeProject.info.objectForPrimaryKey(DatabaseSample, sampleId);
    return realmObjectToJson(data) ?? undefined;
}

export function createSample(data: IDatabaseSample): boolean {
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

export async function createAnnotations(sampleId: string, annotations: IDatabaseAnnotation[]): Promise<IDatabaseSample | null> {
    if (!activeProject) {
        return null;
    }

    const realm = activeProject.info;

    try {
        const sample = realm.objectForPrimaryKey(DatabaseSample, sampleId);
        if (!sample) return sample;

        realm.write(() => {
            sample.annotations.push(...annotations);
        })

        return realmObjectToJson(sample);
    } catch (error) {
        console.error(error)
    }

    return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSample, sampleId));
}

export async function updateAnnotations(sampleId: string, annotations: TUpdateWithId<IDatabaseAnnotation>[]): Promise<IDatabaseSample | null> {
    if (!activeProject) {
        return null;
    }

    const realm = activeProject.info;

    try {
        
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
    } catch (error) {
        console.error(error)
    }

    return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSample,sampleId));
}

export async function removeAnnotations(sampleId: string, annotations: string[]): Promise<IDatabaseSample | null> {
    if (!activeProject) {
        return null;
    }

    const realm = activeProject.info;

    try {
        const sample = realm.objectForPrimaryKey(DatabaseSample,sampleId);

        if(!sample) return sample;

        realm.write(() => {
            sample.annotations = sample.annotations.filter(c => {
                if(annotations.includes(c.id)){
                    realm.delete(c)
                    return false;
                }

                return true;
            })
        })

        return realmObjectToJson(sample);
    } catch (error) {
        console.error(error)
    }

    return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSample,sampleId));
}

export async function createPoints(sampleId: string,annotationId: string,points: IDatabasePoint[]): Promise<IDatabaseAnnotation | null> {
    if (!activeProject) {
        return null;
    }
    const realm = activeProject.info;

    try {
        const annotation = realm.objectForPrimaryKey(DatabaseAnnotation,annotationId);
        if(!annotation) return annotation;

        realm.write(() => {
            annotation.points.push(...points);
        })

        return realmObjectToJson(annotation);
    } catch (error) {
        console.error(error)
    }

    return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation,annotationId));
}

export async function updatePoints(sampleId: string,annotationId: string,points: TUpdateWithId<IDatabasePoint>[]): Promise<IDatabaseAnnotation | null> {
    if (!activeProject) {
        return null;
    }
    const realm = activeProject.info;

    try {
        
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
    } catch (error) {
        console.error(error)
    }

    return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation,annotationId));
}



export async function removePoints(sampleId: string,annotationId: string, points: string[]): Promise<IDatabaseAnnotation | null> {
    if (!activeProject) {
        return null;
    }
    const realm = activeProject.info;

    try {
        const annotation = realm.objectForPrimaryKey(DatabaseAnnotation,annotationId);
        if(!annotation) return annotation;

        realm.write(() => {
            annotation.points = annotation.points.filter((c) => {
                if(points.includes(c.id)){
                    realm.delete(c);
                    return false;
                }
                return true;
            })
        })

        return realmObjectToJson(annotation);
    } catch (error) {
        console.error(error)
    }

    return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation,annotationId));
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

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSampleList, 0))?.samples ?? []
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

        return await createAnnotations(sampleId, annotations);
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("updateAnnotations", async (sampleId, annotations) => {
    try {

        return await updateAnnotations(sampleId, annotations);
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("removeAnnotations", async (sampleId, annotations) => {
    try {
        return removeAnnotations(sampleId,annotations)
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("createPoints", async (sampleId,annotationId, points) => {
    try {

        return createPoints(sampleId,annotationId,points)
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("updatePoints", async (sampleId,annotationId, points) => {
    try {

        return updatePoints(sampleId,annotationId,points)
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("removePoints", async (sampleId,annotationId, points) => {
    try {

        return removePoints(sampleId,annotationId,points)
    } catch (error) {
        console.error(error);
    }

    return null;
})

