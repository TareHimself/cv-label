import path from 'path';
import { ELabelType, IDatabaseAnnotation,IDatabaseImage,IDatabaseInstance,IDatabasePoint, IDatabaseSample, IDatabaseSampleList,TUpdateWithId } from "@types";
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

export class DatabaseImage extends Realm.Object<IDatabaseImage> {
    declare id: string;
    declare name: string;
    declare width: number;
    declare height: number;
    declare extension: string;
    //declare createdAt: string;
    static schema: ObjectSchema = {
        name: "DatabaseImage",
        properties: {
            id: "string",
            name: "string",
            width: "int",
            height: "int",
            extension: "string",
        },
        primaryKey: "id",
    };
}

export class DatabaseSample extends Realm.Object<IDatabaseSample> {
    declare id: string;
    declare imageId: string;
    declare annotations: IDatabaseAnnotation[];
    //declare createdAt: string;
    static schema: ObjectSchema = {
        name: "DatabaseSample",
        properties: {
            id: "string",
            imageId: "string",
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
        return undefined
    }

    return obj.toJSON() as unknown as T
}

function realmObjectToJsonChecked<T>(obj: Realm.Object<T>) {
    return obj.toJSON() as unknown as T
}

export class RealmDatabaseInstance implements IDatabaseInstance {
    realm?: Realm
    path = "";
    async open(projectId: string) {
        this.path = path.join(getProjectsPath(),projectId,"realm");
        this.realm = await Realm.open({
            schema: [DatabasePoint, DatabaseAnnotation, DatabaseSample,DatabaseImage, DatabaseSampleList],
            path: this.path,
        });
    }

    close(){
        this.realm?.close();
    }


    async getSample(sampleId: string): Promise<IDatabaseSample | undefined> {
        if (!this.realm || !sampleId) {
            return undefined;
        }
        const data = this.realm.objectForPrimaryKey(DatabaseSample, sampleId);
        return realmObjectToJson(data) ?? undefined
    }

    async getImage(imageId: string): Promise<IDatabaseImage | undefined> {
        if (!this.realm || !imageId) {
            return undefined;
        }
        const data = this.realm.objectForPrimaryKey(DatabaseImage, imageId);
        return realmObjectToJson(data) ?? undefined
    }

    async getSamples(): Promise<IDatabaseSample[] | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const data = this.realm.objects(DatabaseSample);
        
        return data.map(realmObjectToJsonChecked);
    }

    async getImages(): Promise<IDatabaseImage[] | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const data = this.realm.objects(DatabaseImage);
        
        return data.map(realmObjectToJsonChecked);
    }

    async createImage(data: IDatabaseImage): Promise<boolean> {
        if (!this.realm) {
            return false;
        }

        try {
            const realm = this.realm;

            realm.write(() => {
                realm.create(DatabaseImage, data);
            })
            return true;
        } catch (error) {
            console.error(error)
            return false;
        }
    }

    async createSample(data: IDatabaseSample): Promise<boolean> {
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

    async createAnnotations(sampleId: string, annotations: IDatabaseAnnotation[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
        }

        const realm = this.realm;

        try {
            const sample = realm.objectForPrimaryKey(DatabaseSample, sampleId);
            if (!sample) return undefined;

            realm.write(() => {
                sample.annotations.push(...annotations);
            })

            return realmObjectToJson(sample);
        } catch (error) {
            console.error(error)
        }

        return realmObjectToJson(realm.objectForPrimaryKey(DatabaseSample, sampleId));
    }

    async updateAnnotations(sampleId: string, annotations: TUpdateWithId<IDatabaseAnnotation>[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
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

    async removeAnnotations(sampleId: string, annotations: string[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
        }

        const realm = this.realm;

        try {
            const sample = realm.objectForPrimaryKey(DatabaseSample, sampleId);

            if (!sample) return undefined;

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

    async createPoints(sampleId: string, annotationId: string, points: IDatabasePoint[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const realm = this.realm;

        try {
            const annotation = realm.objectForPrimaryKey(DatabaseAnnotation, annotationId);
            if (!annotation) return undefined;

            realm.write(() => {
                annotation.points.push(...points);
            })

            return this.getSample(sampleId)
        } catch (error) {
            console.error(error)
        }

        return undefined
    }

    async replacePoints(sampleId: string, annotationId: string, points: IDatabasePoint[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const realm = this.realm;

        try {
            const annotation = realm.objectForPrimaryKey(DatabaseAnnotation, annotationId);
            if (!annotation) return undefined;

            realm.write(() => {
                annotation.points.forEach((pt) => {
                    realm.delete(pt);
                });
                annotation.points = [];
                annotation.points.push(...points);
            })

            return this.getSample(sampleId)
        } catch (error) {
            console.error(error)
        }

        return undefined
    }

    async updatePoints(sampleId: string, annotationId: string, points: TUpdateWithId<IDatabasePoint>[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const realm = this.realm;

        try {

            realm.write(() => {
                points.forEach((pt) => {
                    const ptFromDb = realm.objectForPrimaryKey(DatabasePoint, pt.id)
                    if (ptFromDb != null) {
                        if(pt.x !== undefined)
                            ptFromDb.x = pt.x
                        if(pt.y !== undefined)
                            ptFromDb.y = pt.y
                        const ptKeys = Object.keys(pt);
                        for (const ptKey of ptKeys) {
                            if (ptKey !== 'id' && ptFromDb[ptKey] !== undefined) {
                                (ptFromDb[ptKey] as unknown) = pt[ptKey] as unknown;
                            }
                        }
                    }

                })
            })

            return this.getSample(sampleId)
        } catch (error) {
            console.error(error)
        }

        return undefined
    }



    async removePoints(sampleId: string, annotationId: string, points: string[]): Promise<IDatabaseSample | undefined> {
        if (!this.realm) {
            return undefined;
        }
        const realm = this.realm;

        try {
            const annotation = realm.objectForPrimaryKey(DatabaseAnnotation, annotationId);
            if (!annotation) return undefined;

            realm.write(() => {
                annotation.points = annotation.points.filter((c) => {
                    if (points.includes(c.id)) {
                        realm.delete(c);
                        return false;
                    }
                    return true;
                })
            })

            return this.getSample(sampleId)
        } catch (error) {
            console.error(error)
        }

        return undefined
    }
}