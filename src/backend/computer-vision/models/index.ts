/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CvLabel,
  ECVModelType,
  ICVModelInferenceResults,
  ValueOf,
} from "@types";
import { InferenceSession } from "onnxruntime-node";

export type GenericComputerVisionModel = ComputerVisionModel<
  CvLabel[],
  ValueOf<typeof ECVModelType>
>;

export default class ComputerVisionModel<
  PredictionResult extends CvLabel[],
  Model extends ValueOf<typeof ECVModelType>
> {
  modelType: ECVModelType;

  constructor(modelId: Model) {
    this.modelType = modelId;
  }

  static getSessionOptions() {
    const opts: InferenceSession.SessionOptions = {
      executionProviders: ["cpu"],
    };
    return opts;
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
