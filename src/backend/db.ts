/* eslint-disable @typescript-eslint/no-unused-vars */
import { Sequelize, Model, DataTypes } from "sequelize";
import path from 'path';
import { ELabelType, IDatabaseAnnotation, IDatabasePoint, IDatabaseSample } from "@types";


export class DatabasePoint extends Model<IDatabasePoint, IDatabasePoint> {
    declare id: string;
    declare x: number;
    declare y: number;
}



export class DatabaseAnnotation extends Model<IDatabaseAnnotation<string[]>,IDatabaseAnnotation<string[]>> {
    declare id: string;
    declare type: ELabelType;
    declare class: number;
    declare points: string[];
}

export class DatabaseSample extends Model<IDatabaseSample<string[]>,Pick<IDatabaseSample<string[]>,'id' | 'annotations'>> {
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
        if(activeProject.path === projectPath){
            return
        }
        await Promise.all([activeProject.info.close()])
    }

    const info = new Sequelize({
        dialect: 'sqlite',
        storage: `${path.join(projectPath, 'info.db')}`
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
    }, { sequelize: info, tableName: "samples",updatedAt: false, hooks : {
        beforeValidate(attributes, options) {
            if(attributes.annotations !== undefined){
                attributes.annotations = (attributes.annotations.join(',') as unknown as string[])
            }
        },
        afterFind(instancesOrInstance, options) {
            if(instancesOrInstance !== null){
                if(instancesOrInstance instanceof Array){
                    for(const d of instancesOrInstance){
                        if(d.annotations === undefined){
                            break;
                        }
                        d.annotations = (d.annotations as unknown as string).split(',')
                    }
                }
                else
                {
                    if(instancesOrInstance.annotations !== undefined){
                        instancesOrInstance.annotations = (instancesOrInstance.annotations as unknown as string).split(',')
                    }
                }
            }
        },
    },validate: undefined })


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
    }, { sequelize: info, tableName: "annotations", hooks: {
        beforeValidate(attributes, options) {
            if(attributes.points !== undefined){
                attributes.points = (attributes.points.join(',') as unknown as string[])
            }
        },
        afterFind(instancesOrInstance, options) {
            if(instancesOrInstance !== null){
                if(instancesOrInstance instanceof Array){
                    for(const d of instancesOrInstance){
                        if(d.points === undefined){
                            break;
                        }
                        d.points = (d.points as unknown as string).split(',')
                    }
                }
                else
                {
                    if(instancesOrInstance.points !== undefined){
                        instancesOrInstance.points = (instancesOrInstance.points as unknown as string).split(',')
                    }
                }
            }
        },
    } })

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

    activeProject = {
        info,
        path: projectPath
    }

    await Promise.all([DatabaseSample.sync(),DatabaseAnnotation.sync(),DatabasePoint.sync()])

    return;
}
