import { ECVModelType, ILabel, ISample, ValueOf } from "@types"

export class ComputerVisionImporter {
    name: string;

    static ALL_IMPORTERS: ComputerVisionImporter[] = []

    constructor(name: string){
        this.name = name
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async import(datasetPath: string): Promise<ISample[]>{
        throw new Error("Importer not implemented")
    }
}