/* eslint-disable @typescript-eslint/no-unused-vars */
import { ECVModelType, ICVModelInferenceResults, ValueOf } from "@types"
import { InferenceSession } from "onnxruntime-node"



export type GenericComputerVisionModel = ComputerVisionModel<unknown,unknown,ValueOf<typeof ECVModelType>>

export default class ComputerVisionModel<InputType,RawPredictionResult,Model extends ValueOf<typeof ECVModelType>>{
    

    static getSessionOptions(){
        const opts: InferenceSession.SessionOptions = { executionProviders : ['cpu']}
        return opts
    }


    public async predict(imagePath: string): Promise<ICVModelInferenceResults[Model]>{
        const input = await this.loadImage(imagePath)
        const output = await this.predictRaw(input)
        return await this.rawToResult(input,output) 
    }

    async loadImage(imagePath: string): Promise<InputType>{
        throw new Error("Not Implemented")
    }

    public async predictRaw(data: InputType): Promise<RawPredictionResult>{
        throw new Error("Not Implemented")
    }

    async rawToResult(input: InputType,output: RawPredictionResult): Promise<ICVModelInferenceResults[Model]>{
        throw new Error("Not Implemented")
    }

}