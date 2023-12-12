/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CvAnnotation,
  ValueOf,
} from "@types";

export default class ComputerVisionModel<
  PredictionResult extends CvAnnotation[] = CvAnnotation[]
> {

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
