import path from 'path';
import { v4 as uuidv4 } from "uuid";
import { ELabelType, IDatabaseAnnotation, IDatabasePoint, IDatabaseSample, IDatabaseSampleList, IProject, TUpdateWithId } from "@types";
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
    declare width: number;
    declare height: number;
    //declare createdAt: string;
    static schema: ObjectSchema = {
        name: "DatabaseSample",
        properties: {
            id: "string",
            width: "int",
            height: "int",
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


function realmObjectToJson<T>(obj: Realm.Object<T> | null) {
    if (!obj) {
        return null
    }

    return obj.toJSON() as unknown as T
}

function realmObjectToJsonChecked<T>(obj: Realm.Object<T>) {
    return obj.toJSON() as unknown as T
}

class DatabaseInstance {
    realm?: Realm
    path = "";

    async open(path: string) {
        this.path = path;
        this.realm = await Realm.open({
            schema: [DatabasePoint, DatabaseAnnotation, DatabaseSample, DatabaseSampleList],
            path: this.path,
        });
    }

    close(){
        this.realm?.close();
    }


    async findSampleByPk(sampleId: string): Promise<IDatabaseSample | undefined> {
        if (!this.realm || !sampleId) {
            return undefined;
        }
        const data = this.realm.objectForPrimaryKey(DatabaseSample, sampleId);
        return realmObjectToJson(data) ?? undefined
    }

    async getSamples(): Promise<IDatabaseSample[] | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const data = this.realm.objects(DatabaseSample);
        
        return data.map(realmObjectToJsonChecked);
    }

    createSample(data: IDatabaseSample): boolean {
        if (!this.realm) {
            return false;
        }

        try {
            const realm = this.realm;

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

    async createAnnotations(sampleId: string, annotations: IDatabaseAnnotation[]): Promise<IDatabaseSample | null> {
        if (!this.realm) {
            return null;
        }

        const realm = this.realm;

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

    async updateAnnotations(sampleId: string, annotations: TUpdateWithId<IDatabaseAnnotation>[]): Promise<IDatabaseSample | null> {
        if (!this.realm) {
            return null;
        }

        const realm = this.realm;

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

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSample, sampleId));
    }

    async removeAnnotations(sampleId: string, annotations: string[]): Promise<IDatabaseSample | null> {
        if (!this.realm) {
            return null;
        }

        const realm = this.realm;

        try {
            const sample = realm.objectForPrimaryKey(DatabaseSample, sampleId);

            if (!sample) return sample;

            realm.write(() => {
                sample.annotations = sample.annotations.filter(c => {
                    if (annotations.includes(c.id)) {
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

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSample, sampleId));
    }

    async createPoints(sampleId: string, annotationId: string, points: IDatabasePoint[]): Promise<IDatabaseAnnotation | null> {
        if (!this.realm) {
            return null;
        }
        const realm = this.realm;

        try {
            const annotation = realm.objectForPrimaryKey(DatabaseAnnotation, annotationId);
            if (!annotation) return annotation;

            realm.write(() => {
                annotation.points.push(...points);
            })

            return realmObjectToJson(annotation);
        } catch (error) {
            console.error(error)
        }

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation, annotationId));
    }

    async replacePoints(sampleId: string, annotationId: string, points: IDatabasePoint[]): Promise<IDatabaseAnnotation | null> {
        if (!this.realm) {
            return null;
        }
        const realm = this.realm;

        try {
            const annotation = realm.objectForPrimaryKey(DatabaseAnnotation, annotationId);
            if (!annotation) return annotation;

            realm.write(() => {
                annotation.points.forEach((pt) => {
                    realm.delete(pt);
                });
                annotation.points = [];
                annotation.points.push(...points);
            })

            return realmObjectToJson(annotation);
        } catch (error) {
            console.error(error)
        }

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation, annotationId));
    }

    async updatePoints(sampleId: string, annotationId: string, points: TUpdateWithId<IDatabasePoint>[]): Promise<IDatabaseAnnotation | null> {
        if (!this.realm) {
            return null;
        }
        const realm = this.realm;

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

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation, annotationId));
    }



    async removePoints(sampleId: string, annotationId: string, points: string[]): Promise<IDatabaseAnnotation | null> {
        if (!this.realm) {
            return null;
        }
        const realm = this.realm;

        try {
            const annotation = realm.objectForPrimaryKey(DatabaseAnnotation, annotationId);
            if (!annotation) return annotation;

            realm.write(() => {
                annotation.points = annotation.points.filter((c) => {
                    if (points.includes(c.id)) {
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

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseAnnotation, annotationId));
    }
}

export interface IActiveProject {
    info: Realm;
    path: string
}

let activeDatabase: DatabaseInstance | undefined = undefined;

export function getActiveProject() {
    return activeDatabase;
}

export async function createOrOpenProjectDatabase(projectPath: string,bReplaceActive = true) {
    const dbPath = path.join(projectPath, "realm", "db");

    if(activeDatabase?.path == dbPath){
        return activeDatabase;
    }

    if(!bReplaceActive){
        const d = new DatabaseInstance();
        await d.open(dbPath);
        return d;
    }

    activeDatabase?.close();

    const db = new DatabaseInstance();

    await db.open(dbPath);

    activeDatabase = db;

    return db;
}



window.ioBridge.handle("getSample", async (sampleId) => {
    try {
        return await activeDatabase?.findSampleByPk(sampleId)
    } catch (error) {
        console.error(error)
    }

    return undefined;
})

window.ioBridge.handle("getSampleIds", async () => {
    try {
        const realm = activeDatabase?.realm;
        if (!realm) return [];

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSampleList, 0))?.samples ?? []
    } catch (error) {
        console.error(error);
    }

    return [];
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.ioBridge.handle("createProject", async (name) => {
    try {
        const projectId = uuidv4().replace(/-/g, "");
        const projectPath = path.join(getProjectsPath(), projectId)
        await fs.promises.mkdir(projectPath, {
            recursive: true,
        });

        await createOrOpenProjectDatabase(projectPath)

        const projectInfo: IProject = {
            id: projectId,
            name: name
        }

        await fs.promises.writeFile(projectPath + ".json",JSON.stringify(projectInfo));

        return projectInfo;
    } catch (error) {
        console.error(error);
    }

    return undefined;
});

window.ioBridge.handle("getProjects", async () => {
    try {
        
        const files = await Promise.all(await fs.promises.readdir(getProjectsPath(),{
            recursive: false
        }).then(c => c.filter(a => a.endsWith('.json')).map(d => fs.promises.readFile(path.join(getProjectsPath(),d),'ascii').then(f => JSON.parse(f) as IProject))));

        return files;
    } catch (error) {
        console.error(error);
    }

    return [];
})



window.ioBridge.handle("activateProject", async (projectId) => {
    try {
        const projectPath = path.join(getProjectsPath(), projectId)
        await createOrOpenProjectDatabase(projectPath)
        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

window.ioBridge.handle("createAnnotations", async (sampleId, annotations) => {
    try {

        return await activeDatabase?.createAnnotations(sampleId, annotations) ?? null; 
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("updateAnnotations", async (sampleId, annotations) => {
    try {

        return await activeDatabase?.updateAnnotations(sampleId, annotations) ?? null;
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("removeAnnotations", async (sampleId, annotations) => {
    try {
        return activeDatabase?.removeAnnotations(sampleId, annotations) ?? null;
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("createPoints", async (sampleId, annotationId, points) => {
    try {

        return activeDatabase?.createPoints(sampleId, annotationId, points) ?? null;
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("replacePoints", async (sampleId, annotationId, points) => {
    try {
        return activeDatabase?.replacePoints(sampleId, annotationId, points) ?? null
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("updatePoints", async (sampleId, annotationId, points) => {
    try {

        return activeDatabase?.updatePoints(sampleId, annotationId, points) ?? null;
    } catch (error) {
        console.error(error);
    }

    return null;
})

window.ioBridge.handle("removePoints", async (sampleId, annotationId, points) => {
    try {

        return activeDatabase?.removePoints(sampleId, annotationId, points) ??null;
    } catch (error) {
        console.error(error);
    }

    return null;
})

