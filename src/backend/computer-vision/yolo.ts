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
      await InferenceSession.create(modelPath, Yolov8.getSessionOptions())
    );
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
    const rawResult = (
      await pythonUtils
        .get("format_detect_result")
        .callAsync(
          [Array.from(output.data as Float32Array), output.dims],
          [input.width, input.height],
          [Yolov8Detection.inferenceDims.x, Yolov8Detection.inferenceDims.y]
        )
    ).toJS();

    const rawBoxes: number[][] = rawResult.boxes;

    const allBoxes: Yolov8DetectionResult = rawBoxes.map((a) => {
      return {
        x1: a[0],
        y1: a[1],
        x2: a[2],
        y2: a[3],
        class: a[4],
        confidence: a[5],
      };
    });

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
      await InferenceSession.create(modelPath, Yolov8.getSessionOptions())
    );
  }

  override async predictRaw(
    data: Yolov8InputType
  ): Promise<Yolov8SegmentationResultRaw> {
    const input = new Tensor(data.data, [1, 3, 640, 640]);
    const outputs = await this.model.run({ images: input });

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

    const processed = (
      await pythonUtils.get("format_seg_results").callAsync(
        [Array.from(out1.data as Float32Array), out1.dims],
        [Array.from(out2.data as Float32Array), out2.dims],
        //[input.width, input.height],
        [input.width, input.height],
        [Yolov8Detection.inferenceDims.x, Yolov8Detection.inferenceDims.y]
      )
    ).toJS();

    const rawBoxes: number[][] = processed.boxes;
    const masks: [number, number][][] = processed.masks;

    return rawBoxes
      .map((a, idx) => {
        return {
          x1: a[0],
          y1: a[1],
          x2: a[2],
          y2: a[3],
          class: a[4],
          confidence: a[5],
          mask: masks[idx],
        };
      })
      .sort((box1, box2) => box2.confidence - box1.confidence);
  }
}
