import {
  CvBoxLabel,
  CvLabel,
  CvSegmentLabel,
  ECVModelType,
  ELabelType,
  ICVModelInferenceResults,
} from "@types";
import { ComputerVisionLabeler } from ".";

export class Yolov8Labeler<
  T extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> extends ComputerVisionLabeler<T> {}

export class YoloV8DetectLabeler extends Yolov8Labeler<ECVModelType.Yolov8Detect> {
  constructor() {
    super(ECVModelType.Yolov8Detect);
  }

  override async inferenceToLabel(
    inferenceResult: ICVModelInferenceResults[ECVModelType.Yolov8Detect]
  ): Promise<CvLabel[]> {
    return inferenceResult.map((a) => {
      const label: CvBoxLabel = {
        x1: a.x1,
        y1: a.y1,
        x2: a.x2,
        y2: a.y2,
        classIndex: a.class,
        type: ELabelType.BOX,
      };

      return label;
    });
  }
}

export class YoloV8SegmentLabeler extends Yolov8Labeler<ECVModelType.Yolov8Seg> {
  constructor() {
    super(ECVModelType.Yolov8Seg);
  }

  override async inferenceToLabel(
    inferenceResult: ICVModelInferenceResults[ECVModelType.Yolov8Seg]
  ): Promise<CvLabel[]> {
    return inferenceResult.map((a) => {
      const label: CvSegmentLabel = {
        points: a.mask,
        classIndex: a.class,
        type: ELabelType.SEGMENT,
      };

      return label;
    });
  }
}
