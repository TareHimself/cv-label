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
import { nonMaxSuppression, scaleBoxes } from "./yoloUtils";
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
    // const img = sharp(imagePath);

    // const meta = await img.metadata();
    // const [img_width, img_height] = [meta.width, meta.height];

    // const pixels = await img
    //   .removeAlpha()
    //   .resize({ width: 640, height: 640, fit: "contain" }) // Yolo pads to maintain aspect ratio
    //   .raw()
    //   .toBuffer();

    // const red: number[] = [],
    //   green: number[] = [],
    //   blue: number[] = [];

    // for (let index = 0; index < pixels.length; index += 3) {
    //   red.push(pixels[index] / 255.0);
    //   green.push(pixels[index + 1] / 255.0);
    //   blue.push(pixels[index + 2] / 255.0);
    // }

    let data = await torch.vision.io.readImage(imagePath);

    const [imgDims, imgHeight, imgWidth] = data.shape;
    console.log("INITIAL", imgDims, imgHeight, imgWidth);
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
        [640, 640]
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
    const preds = nonMaxSuppression(result);
    console.timeEnd("NMS");
    await sleep(100); // Induced delay to free up event loop
    const pred = preds[0];
    const scaled = scaleBoxes([640, 640], pred.get([], [null, 4]), [
      inputDims.height,
      inputDims.width,
    ]);
    pred.set(scaled, [], [null, 4]);

    console.log(pred.shape, pred.toMultiArray().length);

    // const output = await this.model.forward(input);

    // const output = outputs["output0"];

    // const result = await this.model.call(
    //   "predict",
    //   imagePath,
    //   Yolov8Detection.inferenceDims
    // );

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

    console.log(allBoxes[0]);

    return allBoxes;
    // allBoxes.sort((box1, box2) => box2.confidence - box1.confidence);

    // return allBoxes.map((c) => {
    //   return {
    //     points: [
    //       [c.x1, c.y1],
    //       [c.x2, c.y2],
    //     ],
    //     type: ELabelType.BOX,
    //     classIndex: c.class,
    //   };
    // });
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
    const img = sharp(imagePath);

    const meta = await img.metadata();
    const [img_width, img_height] = [meta.width, meta.height];

    const pixels = await img
      .removeAlpha()
      .resize({ width: 640, height: 640, fit: "contain" }) // Yolo pads to maintain aspect ratio
      .raw()
      .toBuffer();

    const red: number[] = [],
      green: number[] = [],
      blue: number[] = [];

    for (let index = 0; index < pixels.length; index += 3) {
      red.push(pixels[index] / 255.0);
      green.push(pixels[index + 1] / 255.0);
      blue.push(pixels[index + 2] / 255.0);
    }

    const data = Float32Array.from([...red, ...green, ...blue]);

    const inputDims = {
      width: img_width ?? -1,
      height: img_height ?? -1,
    };

    const input = torch.tensor(data, []);

    nonMaxSuppression(input);
    return [];
  }
}
