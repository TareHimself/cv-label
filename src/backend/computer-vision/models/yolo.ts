import ComputerVisionModel from ".";
import {
  CvBoxAnnotation,
  CvSegmentAnnotation,
  ECVModelType,
  ELabelType,
  ICVModelInferenceResults,
} from "@types";
import path from "path";
import sharp from "sharp";
import * as torch from "@nodeml/torch";
import { masks2segmentsScaled, nonMaxSuppression, processMaskUpsample, scaleBoxes } from "./yoloUtils";
import { sleep } from "@root/utils";

export type Yolov8InputType = {
  data: number[];
  width: number;
  height: number;
};

abstract class Yolov8<
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> extends ComputerVisionModel<
  Model extends ECVModelType.Yolov8Detect
  ? CvBoxAnnotation[]
  : CvSegmentAnnotation[],
  Model
> {
  model: torch.jit.Module<Yolov8TorchscriptModelResult<Model>>;
  constructor(
    modelId: Model,
    model: torch.jit.Module<Yolov8TorchscriptModelResult<Model>>
  ) {
    super(modelId);
    this.model = model;
  }
}

type Yolov8DetectionResult =
  ICVModelInferenceResults[ECVModelType.Yolov8Detect];

type Yolov8TorchscriptModelResult<
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> = Model extends ECVModelType.Yolov8Detect
  ? torch.Tensor<"float">
  : [torch.Tensor<"float">, torch.Tensor<"float">];

export class Yolov8Detection extends Yolov8<ECVModelType.Yolov8Detect> {
  constructor(
    model: torch.jit.Module<
      Yolov8TorchscriptModelResult<ECVModelType.Yolov8Detect>
    >
  ) {
    super(ECVModelType.Yolov8Detect, model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Detection(await torch.jit.load(path.resolve(modelPath)));
  }

  override async handlePredict(imagePath: string): Promise<CvBoxAnnotation[]> {

    let data = await torch.vision.io.readImage(imagePath);

    const [imgDims, imgHeight, imgWidth] = data.shape;

    if (imgDims > 3) {
      data = data.get([1, null]);
    }
    const maxDim = Math.max(imgHeight, imgWidth);
    const halfWidth = Math.round((maxDim - imgWidth) / 2);
    const halfHeight = Math.round((maxDim - imgHeight) / 2);
    const input = torch.nn.functional
      .interpolate(
        torch.nn.functional.pad(data.unsqueeze(0), [
          halfWidth,
          halfWidth,
          halfHeight,
          halfHeight,
        ]),
        [640, 640], 'nearest'
      )
      .type(torch.types.float)
      .div(255);

    const inputDims = {
      width: imgWidth,
      height: imgHeight,
    };

    await sleep(100); // Induced delay to free up event loop

    console.time("FORWARD");
    const result = await this.model.forward(input);
    console.timeEnd("FORWARD");
    await sleep(100); // Induced delay to free up event loop
    console.time("NMS");
    const preds = nonMaxSuppression(result, result.shape[1] - 4);
    console.timeEnd("NMS");
    await sleep(100); // Induced delay to free up event loop
    const pred = preds[0];
    const scaled = scaleBoxes([640, 640], pred.get([], [null, 4]), [
      inputDims.height,
      inputDims.width,
    ]);
    pred.set(scaled, [], [null, 4]);

    const allBoxes: CvBoxAnnotation[] = [];

    for (let i = 0; i < pred.shape[0]; i++) {
      const a = pred.get(i).get([0, null]).toArray();
      allBoxes.push({
        points: [
          [a[0], a[1]],
          [a[2], a[3]],
        ],
        type: ELabelType.BOX,
        classIndex: Math.round(a[4]),
      });
    }

    return allBoxes;
  }
}

export class Yolov8Segmentation extends Yolov8<ECVModelType.Yolov8Seg> {
  constructor(
    model: torch.jit.Module<
      Yolov8TorchscriptModelResult<ECVModelType.Yolov8Seg>
    >
  ) {
    super(ECVModelType.Yolov8Seg, model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Segmentation(
      await torch.jit.load(path.resolve(modelPath))
    );
  }

  override async handlePredict(
    imagePath: string
  ): Promise<CvSegmentAnnotation[]> {
    let data = await torch.vision.io.readImage(imagePath);

    const [imgDims, imgHeight, imgWidth] = data.shape;

    if (imgDims > 3) {
      data = data.get([1, null]);
    }
    const maxDim = Math.max(imgHeight, imgWidth);
    const halfWidth = Math.round((maxDim - imgWidth) / 2);
    const halfHeight = Math.round((maxDim - imgHeight) / 2);
    const input = torch.nn.functional
      .interpolate(
        torch.nn.functional.pad(data.unsqueeze(0), [
          halfWidth,
          halfWidth,
          halfHeight,
          halfHeight,
        ]),
        [640, 640], 'nearest'
      )
      .type(torch.types.float)
      .div(255);

    const inputDims = {
      width: imgWidth,
      height: imgHeight,
    };

    await sleep(100); // Induced delay to free up event loop

    console.time("FORWARD");
    const [boxes, masksPred] = await this.model.forward(input);
    console.timeEnd("FORWARD");
    await sleep(100); // Induced delay to free up event loop
    console.time("NMS");
    const preds = nonMaxSuppression(boxes, boxes.shape[1] - (4 + 32));
    console.timeEnd("NMS");
    await sleep(100); // Induced delay to free up event loop

    const proto = masksPred.get(0)

    const pred = preds[0];

    if (!pred.shape[0]) {
      return []
    }
    console.time("Mask Extraction");
    const masksUpsampled = processMaskUpsample(proto, pred.get([], [6, null]), pred.get([], [null, 4]), [640, 640])
    const segments = masks2segmentsScaled(masksUpsampled, [inputDims.width, inputDims.height])
    console.timeEnd("Mask Extraction");
    return segments.map((seg) => {

      return {
        points: seg,
        type: ELabelType.SEGMENT,
        classIndex: Math.round(boxes.get(0).get(4).type('int32').toArray()[0]),
      }
    })
  }
}
