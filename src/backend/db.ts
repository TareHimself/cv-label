/* eslint-disable @typescript-eslint/no-unused-vars */
import { Sequelize, Model, DataTypes } from "sequelize";
import path from 'path';
import { v4 as uuidv4 } from "uuid";
import { ELabelType, IDatabaseAnnotation, IDatabasePoint, IDatabaseSample } from "@types";
import { mainToRenderer } from "@root/ipc-impl";
import * as fs from 'fs';
import { getProjectsPath } from "@root/utils";


export class DatabasePoint extends Model<IDatabasePoint, IDatabasePoint> {
    declare id: string;
    declare x: number;
    declare y: number;
}



export class DatabaseAnnotation extends Model<IDatabaseAnnotation<string[]>, IDatabaseAnnotation<string[]>> {
    declare id: string;
    declare type: ELabelType;
    declare class: number;
    declare points: string[];
}

export class DatabaseSample extends Model<IDatabaseSample<string[]>, Pick<IDatabaseSample<string[]>, 'id' | 'annotations'>> {
    declare id: string;
    declare annotations: string[];
    declare createdAt: string;
}


export interface IActiveProject {
    info: Sequelize;
    path: string
}

let activeProject: IActiveProject | undefined = undefined;

export async function createOrOpenProject(projectPath: string) {

    if (activeProject) {
        if (activeProject.path === projectPath) {
            return
        }
        await Promise.all([activeProject.info.close()])
    }

    const info = new Sequelize({
        dialect: 'sqlite',
        storage: `${path.join(projectPath, 'info.db')}`,
        logging: false,
    });

    DatabaseSample.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        annotations: {
            type: DataTypes.STRING
        },
        createdAt: {
            type: DataTypes.DATE
        }
    }, {
        sequelize: info, tableName: "samples", updatedAt: false, hooks: {
            beforeValidate(attributes, options) {
                if (attributes.annotations !== undefined) {
                    attributes.annotations = (attributes.annotations.join(',') as unknown as string[])
                }
            },
            afterFind(instancesOrInstance, options) {
                if (instancesOrInstance !== null) {
                    if (instancesOrInstance instanceof Array) {
                        for (const d of instancesOrInstance) {
                            if (d.annotations === undefined) {
                                break;
                            }
                            d.annotations = (d.annotations as unknown as string).split(',')
                        }
                    }
                    else {
                        if (instancesOrInstance.annotations !== undefined) {
                            instancesOrInstance.annotations = (instancesOrInstance.annotations as unknown as string).split(',')
                        }
                    }
                }
            },
        }, validate: undefined
    })


    DatabaseAnnotation.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        }
        ,
        type: {
            type: DataTypes.INTEGER
        },
        class: {
            type: DataTypes.INTEGER
        },
        points: {
            type: DataTypes.STRING,
        }
    }, {
        sequelize: info, tableName: "annotations", hooks: {
            beforeValidate(attributes, options) {
                if (attributes.points !== undefined) {
                    attributes.points = (attributes.points.join(',') as unknown as string[])
                }
            },
            afterFind(instancesOrInstance, options) {
                if (instancesOrInstance !== null) {
                    if (instancesOrInstance instanceof Array) {
                        for (const d of instancesOrInstance) {
                            if (d.points === undefined) {
                                break;
                            }
                            d.points = (d.points as unknown as string).split(',')
                        }
                    }
                    else {
                        if (instancesOrInstance.points !== undefined) {
                            instancesOrInstance.points = (instancesOrInstance.points as unknown as string).split(',')
                        }
                    }
                }
            },
        }
    })

    DatabasePoint.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        }
        ,
        x: {
            type: DataTypes.INTEGER
        },
        y: {
            type: DataTypes.INTEGER
        }
    }, { sequelize: info, tableName: "points" })

    DatabaseSample.hasMany(DatabaseAnnotation)
    DatabaseAnnotation.belongsTo(DatabaseSample)

    DatabaseAnnotation.hasMany(DatabasePoint)
    DatabasePoint.belongsTo(DatabaseAnnotation)

    activeProject = {
        info,
        path: projectPath
    }

    await Promise.all([DatabaseSample.sync(), DatabaseAnnotation.sync(), DatabasePoint.sync()])

    return;
}

export async function findSampleByPk(sampleId: string): Promise<IDatabaseSample<IDatabaseAnnotation<IDatabasePoint[]>[]> | undefined> {
    const sampleData = await DatabaseSample.findByPk(sampleId).then(c => c?.get({ plain: true }))

    if (sampleData === undefined) {
        return undefined
    }

    return {
        id: sampleData.id,
        annotations: await DatabaseAnnotation.findAll({
            where: {
                id: sampleData.annotations
            }
        }).then(c => Promise.all(c.map(async (ann) => {
            const annData = ann.get({ plain: true });


            const annotationResult: IDatabaseAnnotation<IDatabasePoint[]> = {
                id: annData.id,
                class: annData.class,
                type: annData.type,
                points: await DatabasePoint.findAll({
                    where: {
                        id: annData.points
                    }
                }).then(d => Promise.all(d.sort((a,b) => annData.points.indexOf(a.id) - annData.points.indexOf(b.id)).map(async (point) => {
                    return {
                        id: point.id,
                        x: point.x,
                        y: point.y
                    }
                })))

            }

            return annotationResult
        }))),
        createdAt: sampleData.createdAt
    }
}

export async function createSampleAnnotationsByPk(sampleId: string, annotations: IDatabaseAnnotation<IDatabasePoint[]>[]) {
    const sampleData = await DatabaseSample.findByPk(sampleId).then(c => c?.get({ plain: true }))

    if (sampleData === undefined) {
        return false
    }


    try {
        const sampleAnnotations = sampleData.annotations;

        await Promise.all(annotations.map(async (annotation) => {
            await DatabaseAnnotation.create({
                id: annotation.id,
                class: annotation.class,
                points: annotation.points.map(c => c.id),
                type: annotation.type,
            })

            await Promise.all(annotation.points.map(async (point) => {
                await DatabasePoint.create({
                    id: point.id,
                    x: point.x,
                    y: point.y
                })
            }))
        }))

        sampleAnnotations.push(...annotations.map(c => c.id))

        await DatabaseSample.update({
            annotations: sampleAnnotations
        }, {
            where: {
                id: sampleId
            }
        })

        return true;
    } catch (error) {
        console.error(error)
        return false;
    }

}

export async function updateSampleAnnotationsByPk(sampleId: string, annotations: IDatabaseAnnotation<IDatabasePoint[]>[]) {
    try {
        const ids: string[] = []

        await Promise.all(annotations.map(async (c) => {
            const result: Partial<typeof c> = c
            const annId = c.id;
            ids.push(annId);
            delete result.id
            const points = result.points !== undefined ? {
                points: result.points.map(c => c.id)
            } : {};

            const pointsObj =  result.points === undefined ? {} : {
                points: result.points.map(c => c.id)
            }

            const finalResult = {...result, ...pointsObj} as Partial<IDatabaseAnnotation<string[]>>

            await DatabaseAnnotation.update({ ...finalResult },{
                where: {
                    id: annId
                }
            })
        }))

        return true;
    } catch (error) {
        console.error(error)
        return false;
    }
}

export async function updatePointsByPk(points: IDatabasePoint[]) {
    try {

        await Promise.all(points.map(async (c) => {
            await DatabasePoint.update({ x: c.x, y: c.y },{
                where: {
                    id: c.id
                }
            })
        }))

        return true;
    } catch (error) {
        console.error(error)
        return false;
    }
}

export async function removeSampleAnnotationsByPk(sampleId: string, annotations: string[]) {
    await DatabaseAnnotation.destroy({
        where: {
            id: annotations
        }
    })
}


mainToRenderer.handle("getSample", async (sampleId) => {
    try {
        return await findSampleByPk(sampleId)
    } catch (error) {
        console.error(error)
    }

    return undefined;
})

mainToRenderer.handle("getSampleIds", async () => {
    try {
        return await DatabaseSample.findAll({
            attributes: ['id'],
            order: [['createdAt', 'DESC']]
        }).then(c => c.map(d => d.id))
    } catch (error) {
        console.error(error);
    }

    return [];
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
mainToRenderer.handle("createProject", async (_name) => {
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



mainToRenderer.handle("activateProject", async (projectId) => {
    try {
        const projectPath = path.join(getProjectsPath(), projectId)
        await createOrOpenProject(projectPath)
        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

mainToRenderer.handle("createAnnotations", async (sampleId, annotations) => {
    try {

        return await createSampleAnnotationsByPk(sampleId, annotations);
    } catch (error) {
        console.error(error);
    }

    return false;
})

mainToRenderer.handle("removeAnnotations", async (sampleId, annotations) => {
    try {
        await removeSampleAnnotationsByPk(sampleId, annotations)
        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

mainToRenderer.handle("createPoints", async (annotationId, points) => {
    try {

        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})

mainToRenderer.handle("updatePoints", async (points) => {
    try {
        
        return await updatePointsByPk(points);
    } catch (error) {
        console.error(error);
    }

    return false;
})

mainToRenderer.handle("removePoints", async (sampleId, annotationId, points) => {
    try {

        return true;
    } catch (error) {
        console.error(error);
    }

    return false;
})
