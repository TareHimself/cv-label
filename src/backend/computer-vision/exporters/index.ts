import { ECVModelType, ILabel, ISample, ValueOf } from "@types"

export class ComputerVisionExporter {
    name: string;

    
    static ALL_EXPORTERS: ComputerVisionExporter[] = []

    constructor(name: string){
        this.name = name
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async export(samples: ISample[]): Promise<boolean>{
        throw new Error("Exporter not implemented")
    }
}