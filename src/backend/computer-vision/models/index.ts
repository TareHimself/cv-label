/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CvAnnotation,
  ECVModelType,
  ValueOf,
} from "@types";

export type GenericComputerVisionModel = ComputerVisionModel<
  CvAnnotation[],
  ValueOf<typeof ECVModelType>
>;

export default class ComputerVisionModel<
  PredictionResult extends CvAnnotation[],
  Model extends ValueOf<typeof ECVModelType>
> {
  modelType: ECVModelType;

  constructor(modelId: Model) {
    this.modelType = modelId;
  }

  public async predict(imagePath: string): Promise<PredictionResult> {
    return await this.handlePredict(imagePath);
  }

  protected async handlePredict(imagePath: string): Promise<PredictionResult> {
    throw new Error("Not Implemented");
  }

  async cleanup() {
    /* Empty */
  }
}
