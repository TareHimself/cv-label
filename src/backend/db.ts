import { Sequelize, Model, DataTypes } from "sequelize";
import path from 'path';
import { ELabelType } from "@types";

interface IDatabasePoint {
    id: string;
    x: string;
    y: string;
}
export class DatabasePoint extends Model<IDatabasePoint,IDatabasePoint> {

}


export interface IDatabaseAnnotation {
    id: string;
    type: ELabelType;
    class: number;
    points: string;
}
export class DatabaseAnnotation extends Model<IDatabaseAnnotation> {

}

export interface IDatabaseSample {
    id: string;
    annotations: string
    added_at: number;
}

export class DatabaseSample extends Model<IDatabaseSample> {

}

export interface IDatabaseImages {
    id: string;
    data: Buffer
}
export class DatabaseImages extends Model<IDatabaseImages,IDatabaseImages> {

}

export interface IActiveProject {
info: Sequelize;
images: Sequelize
}

let activeProject: IActiveProject | undefined = undefined;

export async function createOrOpenProject(projectPath: string) {

    if(activeProject){
        await Promise.all([activeProject.images.close(),activeProject.info.close()])
    }

    const info = new Sequelize({
        dialect: 'sqlite',
        storage: `${path.join(projectPath, 'info.db')}`
    });

    const images = new Sequelize({
        dialect: 'sqlite',
        storage: `${path.join(projectPath, 'images.db')}`
    });



    DatabaseSample.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        annotations: {
            type: DataTypes.STRING
        },
        added_at: {
            type: DataTypes.INTEGER
        }
    }, { sequelize: info,tableName: "samples" })


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
            type: DataTypes.STRING
        }
    }, { sequelize: info,tableName: "annotations" })

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


    DatabaseImages.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        data: {
            type: DataTypes.BLOB
        }
    }, { sequelize: images, tableName: "images" })

    activeProject =  {
        info,images
    }

    return;
}
