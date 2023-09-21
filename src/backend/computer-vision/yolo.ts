import { InferenceSession, Tensor } from "onnxruntime-node";
import sharp from "sharp";
import ComputerVisionModel from ".";
import { pymport, proxify } from "pymport";
const pythonSys = proxify(pymport("sys"));
pythonSys.get("path").insert(0, process.cwd());
const pythonUtils = proxify(pymport("python"));
import { ECVModelType, ICVModelInferenceResults } from "@types";

export type Yolov8InputType = {
  data: Float32Array;
  width: number;
  height: number;
};

abstract class Yolov8<
  RawPredictionResult,
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> extends ComputerVisionModel<Yolov8InputType, RawPredictionResult, Model> {
  model: InferenceSession;
  constructor(model: InferenceSession) {
    super();
    this.model = model;
  }

  static getSessionOptions() {
    const opts: InferenceSession.SessionOptions = {
      executionProviders: ["cpu"],
    };
    return opts;
  }

  override async loadImage(imagePath: string): Promise<Yolov8InputType> {
    const img = sharp(imagePath);

    const meta = await img.metadata();
    const [img_width, img_height] = [meta.width, meta.height];

    const pixels = await img
      .removeAlpha()
      .resize({ width: 640, height: 640, fit: "fill" })
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

    return {
      width: img_width ?? -1,
      height: img_height ?? -1,
      data: Float32Array.from([...red, ...green, ...blue]),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async predictRaw(data: Yolov8InputType): Promise<RawPredictionResult> {
    throw new Error("Not Implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override async rawToResult(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: Yolov8InputType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    output: RawPredictionResult
  ): Promise<ICVModelInferenceResults[Model]> {
    throw new Error("Not Implemented");
  }
}

type Yolov8DetectionResultRaw = Tensor;
type Yolov8DetectionResult =
  ICVModelInferenceResults[ECVModelType.Yolov8Detect];

export class Yolov8Detection extends Yolov8<
  Yolov8DetectionResultRaw,
  ECVModelType.Yolov8Detect
> {
  constructor(model: InferenceSession) {
    super(model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Detection(
      await InferenceSession.create(modelPath, Yolov8.getSessionOptions()));
  }

  override async predictRaw(
    data: Yolov8InputType
  ): Promise<Yolov8DetectionResultRaw> {
    const input = new Tensor(data.data, [1, 3, 640, 640]);
    const outputs = await this.model.run({ images: input });

    const output = outputs["output0"];

    return output;
  }

  override async rawToResult(
    input: Yolov8InputType,
    output: Yolov8DetectionResultRaw
  ): Promise<Yolov8DetectionResult> {

    const rawResult = pythonUtils
    .format_detect_result(
      [Array.from(output.data as Float32Array), output.dims],
      [input.width, input.height],
      [Yolov8Detection.inferenceDims.x, Yolov8Detection.inferenceDims.y]
    )
    .toJS()

    const rawBoxes: number[][] = rawResult.boxes
    
    const allBoxes: Yolov8DetectionResult = rawBoxes.map((a) => {
        return {
            x1: a[0],
            y1: a[1],
            x2: a[2],
            y2: a[3],
            class: a[4],
            confidence: a[5]
        }
    })

    // for (let i = 0; i < output.dims[1]; i++) {
    //   const section = data.slice(i * output.dims[2], (i + 1) * output.dims[2]); // get rows

    //   const possibleProps = section.slice(4);
    //   const maxProb = Math.max(...possibleProps);
    //   const classIndex = possibleProps.indexOf(maxProb);

    //   const [x, y, w, h] = section.slice(0, 4);

    //   const x1 = ((x - w / 2) / Yolov8Detection.inferenceDims.x) * input.width;
    //   const y1 = ((y - h / 2) / Yolov8Detection.inferenceDims.y) * input.height;
    //   const x2 = ((x + w / 2) / Yolov8Detection.inferenceDims.x) * input.width;
    //   const y2 = ((y + h / 2) / Yolov8Detection.inferenceDims.y) * input.height;

    //   allBoxes.push({
    //     x1,
    //     y1,
    //     x2,
    //     y2,
    //     class: classIndex,
    //     confidence: maxProb,
    //   });
    // }

    allBoxes.sort((box1, box2) => box2.confidence - box1.confidence);

    return allBoxes;
  }
}

type Yolov8SegmentationResultRaw = [Tensor, Tensor];
type Yolov8SegmentationResult =
  ICVModelInferenceResults[ECVModelType.Yolov8Seg];

export class Yolov8Segmentation extends Yolov8<
  Yolov8SegmentationResultRaw,
  ECVModelType.Yolov8Seg
> {
  constructor(model: InferenceSession) {
    super(model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Segmentation(
      await InferenceSession.create(modelPath, Yolov8.getSessionOptions()));
  }

  override async predictRaw(
    data: Yolov8InputType
  ): Promise<Yolov8SegmentationResultRaw> {
    const input = new Tensor(data.data, [1, 3, 640, 640]);
    const outputs = await this.model.run({ images: input });
    // const output0 = outputs["output0"];

    // const sectionSize = output0.dims[1];
    // const maxPredicted = output0.dims[2];
    // const firstBatch: number[] = [];

    // for (let j = 0; j < sectionSize; j++) {
    //   firstBatch.push((output0.data as Float32Array)[maxPredicted * j]);
    // }

    // const numClasses = firstBatch.length - 4;

    // const config = new Tensor(
    //   "float32",
    //   new Float32Array([
    //     numClasses, // num class
    //     100, // topk per class
    //     0.45, // iou threshold
    //     0.25, // score threshold
    //   ])
    // ); // nms config tensor

    // const { selected: boxes } = await this.nms.run({
    //   detection: output0,
    //   config,
    // });

    return [outputs["output0"], outputs["output1"]];
  }

  override async rawToResult(
    input: Yolov8InputType,
    output: Yolov8SegmentationResultRaw
  ): Promise<Yolov8SegmentationResult> {
    const [out1, out2] = output;
    // const sectionSize = output.dims[1]
    // const maxPredicted = output.dims[2]
    // console.log(output.dims)
    // const data = output.data as Float32Array

    const processed = pythonUtils
    .format_seg_results(
      [Array.from(out1.data as Float32Array), out1.dims],
      [Array.from(out2.data as Float32Array), out2.dims],
      [input.width, input.height],
      [Yolov8Detection.inferenceDims.x, Yolov8Detection.inferenceDims.y]
    )
    .toJS()

    const rawBoxes: number[][] = processed.boxes
    const masks: [number,number][][] = processed.masks

    return rawBoxes.map((a,idx) => {
        return {
            x1: a[0],
            y1: a[1],
            x2: a[2],
            y2: a[3],
            class: a[4],
            confidence: a[5],
            mask: masks[idx]
        }
    }).sort((box1, box2) => box2.confidence - box1.confidence);
  }
}
