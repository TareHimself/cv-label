import { CvLabel, ECVModelType, ICVModelInferenceResults} from "@types";



export class ComputerVisionLabeler<Model extends ECVModelType>{
    modelType: Model
    constructor(model: Model){
        this.modelType = model
    }


    async loadModel(modelPath: string){
        return await window.bridge.loadModel(this.modelType,modelPath)
    }

    async predict(imagePath: string){
        const inferenceResults = await window.bridge.doInference(this.modelType,imagePath)

        if(inferenceResults === undefined){
            return inferenceResults;
        }

        return await this.inferenceToLabel(inferenceResults)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async inferenceToLabel(inferenceResult: ICVModelInferenceResults[Model]): Promise<CvLabel[]>{
        throw new Error("Not Implemented")
    }
}