import ComputerVisionModel from ".";
import {
  CvBoxAnnotation,
  CvSegmentAnnotation,
  ELabelType,
} from "@types";
import {v4 as uuidv4 } from 'uuid'
import { masks2segmentsScaled, nonMaxSuppression, processMaskUpsample, scaleBoxes } from "./yoloUtils";
import { dialog } from "@electron/remote";
import * as torch from '@nodeml/torch'

export const enum EYoloModelType {
  Yolov8Detect,
  Yolov8Seg,
}

export type Yolov8InputType = {
  data: number[];
  width: number;
  height: number;
};

export async function selectTorchscriptModel(){
  const dialogResult = await dialog.showOpenDialog({
    title: "Select The Torchscript Model",
    properties: ["openFile"],
  });

  if (dialogResult.filePaths.length === 0) {
    return undefined;
  }

  return dialogResult.filePaths[0];
}

abstract class Yolov8<
  Model extends EYoloModelType.Yolov8Detect | EYoloModelType.Yolov8Seg
> extends ComputerVisionModel<
  Model extends EYoloModelType.Yolov8Detect
  ? CvBoxAnnotation[]
  : CvSegmentAnnotation[]> {
  model:  torch.jit.Module<Yolov8TorchscriptModelResult<Model>>;
  constructor(
    model: torch.jit.Module<Yolov8TorchscriptModelResult<Model>>
  ) {
    super();
    this.model = model;
  }
}

type Yolov8TorchscriptModelResult<
  Model extends EYoloModelType.Yolov8Detect | EYoloModelType.Yolov8Seg
> = Model extends EYoloModelType.Yolov8Detect
  ? torch.Tensor<"float">
  : [torch.Tensor<"float">, torch.Tensor<"float">];


export class Yolov8Detection extends Yolov8<EYoloModelType.Yolov8Detect> {
  constructor(
    model: torch.jit.Module<
      Yolov8TorchscriptModelResult<EYoloModelType.Yolov8Detect>
    >
  ) {
    super(model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create() {
    const torchScriptModelPath = await selectTorchscriptModel();

    if(torchScriptModelPath === undefined){
      throw new Error("Failed to find model path");
    }

    return new Yolov8Detection(await torch.jit.load(torchScriptModelPath));
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

    console.time("FORWARD");
    const result = await this.model.forward(input);
    console.timeEnd("FORWARD");

    console.time("NMS");
    const preds = nonMaxSuppression(result, result.shape[1] - 4);
    console.timeEnd("NMS");

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
        id: uuidv4(),
        points: [{
          id: uuidv4(),
          x: a[0],
          y: a[1]
        },
        {
          id: uuidv4(),
          x: a[2],
          y: a[3],
        }],
        type: ELabelType.BOX,
        class: Math.round(a[4]),
      });
    }

    return allBoxes;
  }
}

export class Yolov8Segmentation extends Yolov8<EYoloModelType.Yolov8Seg> {
  constructor(
    model: torch.jit.Module<
      Yolov8TorchscriptModelResult<EYoloModelType.Yolov8Seg>
    >
  ) {
    super(model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create() {

    const torchScriptModelPath = await selectTorchscriptModel();

    if(torchScriptModelPath === undefined){
      throw new Error("Failed to find model path");
    }
    return new Yolov8Segmentation(
      await torch.jit.load(torchScriptModelPath)
    );
  }

  override async handlePredict(
    imagePath: string
  ): Promise<CvSegmentAnnotation[]> {
    console.time("PreProcessing");
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

    console.timeEnd("PreProcessing");

    console.time("FORWARD");
    const [boxes, masksPred] = await this.model.forward(input);
    console.timeEnd("FORWARD");

    console.time("NMS");
    const preds = nonMaxSuppression(boxes, boxes.shape[1] - (4 + 32));
    console.timeEnd("NMS");


    console.time("PostProcessing");

    const proto = masksPred.get(0)

    const pred = preds[0];

    if (!pred.shape[0]) {
      console.timeEnd("PostProcessing");
      return []
    }
    const masksUpsampled = processMaskUpsample(proto, pred.get([], [6, null]), pred.get([], [null, 4]), [640, 640])
    console.timeEnd("PostProcessing");
    const segments = await masks2segmentsScaled(masksUpsampled, [inputDims.width, inputDims.height])
    
    return segments.map((seg) => {

      return {
        id: uuidv4(),
        points: seg.map((s) => {
          return {
            id: uuidv4(),
            x: s[0],
            y: s[1]
          }
        }),
        type: ELabelType.SEGMENT,
        class: Math.round(boxes.get(0).get(4).type('int32').toArray()[0]),
      }
    })
  }
}
