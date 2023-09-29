import { InferenceSession } from "onnxruntime-node";
import sharp from "sharp";
import ComputerVisionModel from ".";
import { pymport, proxify } from "pymport";
const pythonSys = proxify(pymport("sys"));
pythonSys.get("path").insert(0, process.cwd());
const pythonUtils = proxify(pymport("python"));
import { ECVModelType, ICVModelInferenceResults } from "@types";
import { WorkerProcess, createWorkerProcess } from "@root/backend/worker";

export type Yolov8InputType = {
  data: number[];
  width: number;
  height: number;
};

type Yolov8DetectionResultRaw = {
  data: number[];
  dims: number[];
};

type Yolov8SegmentationResultRaw = {
  out1: number[];
  dims1: number[];
  out2: number[];
  dims2: number[];
};

type IDetectionWorkerEvents = {
  infer: (data: number[]) => Promise<Yolov8DetectionResultRaw>;
};

type ISegmentationWorkerEvents = {
  infer: (data: number[]) => Promise<Yolov8SegmentationResultRaw>;
};

type YoloV8WorkerProcess<
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> = WorkerProcess<
  Model extends ECVModelType.Yolov8Detect
    ? IDetectionWorkerEvents
    : ISegmentationWorkerEvents
>;
abstract class Yolov8<
  RawPredictionResult,
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> extends ComputerVisionModel<Yolov8InputType, RawPredictionResult, Model> {
  worker: YoloV8WorkerProcess<Model>;
  constructor(model: YoloV8WorkerProcess<Model>) {
    super();
    this.worker = model;
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
      data: [...red, ...green, ...blue],
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

  override async cleanup(): Promise<void> {
    await this.worker.stop();
  }
}

type Yolov8DetectionResult =
  ICVModelInferenceResults[ECVModelType.Yolov8Detect];

export class Yolov8Detection extends Yolov8<
  Yolov8DetectionResultRaw,
  ECVModelType.Yolov8Detect
> {
  constructor(model: YoloV8WorkerProcess<ECVModelType.Yolov8Detect>) {
    super(model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Detection(
      await createWorkerProcess(
        async (bridge, options, modelPath) => {
          const { InferenceSession, Tensor } = eval(
            `require("onnxruntime-node")`
          ) as typeof import("onnxruntime-node");
          const session = await InferenceSession.create(modelPath, options);

          bridge.handleEvent("infer", async (data) => {
            const input = new Tensor(Float32Array.from(data), [1, 3, 640, 640]);

            const outputs = await session.run({ images: input });

            const output = outputs["output0"];

            return {
              data: Array.from(output.data as Float32Array),
              dims: [...output.dims],
            };
          });
        },
        Yolov8.getSessionOptions(),
        modelPath
      )
    );
  }

  override async predictRaw(
    data: Yolov8InputType
  ): Promise<Yolov8DetectionResultRaw> {
    return await this.worker.call("infer", data.data);
  }

  override async rawToResult(
    input: Yolov8InputType,
    output: Yolov8DetectionResultRaw
  ): Promise<Yolov8DetectionResult> {
    const rawResult = (
      await pythonUtils
        .get("format_detect_result")
        .callAsync(
          [output.data, output.dims],
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

type Yolov8SegmentationResult =
  ICVModelInferenceResults[ECVModelType.Yolov8Seg];

export class Yolov8Segmentation extends Yolov8<
  Yolov8SegmentationResultRaw,
  ECVModelType.Yolov8Seg
> {
  constructor(model: YoloV8WorkerProcess<ECVModelType.Yolov8Seg>) {
    super(model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Segmentation(
      await createWorkerProcess(
        async (bridge, options, modelPath) => {
          const { InferenceSession, Tensor } = eval(
            `require("onnxruntime-node")`
          ) as typeof import("onnxruntime-node");
          const session = await InferenceSession.create(modelPath, options);

          bridge.handleEvent("infer", async (data) => {
            const input = new Tensor(Float32Array.from(data), [1, 3, 640, 640]);

            const outputs = await session.run({ images: input });

            return {
              out1: Array.from(outputs["output0"].data as Float32Array),
              dims1: [...outputs["output0"].dims],
              out2: Array.from(outputs["output1"].data as Float32Array),
              dims2: [...outputs["output1"].dims],
            };
          });
        },
        Yolov8.getSessionOptions(),
        modelPath
      )
    );
  }

  override async predictRaw(
    data: Yolov8InputType
  ): Promise<Yolov8SegmentationResultRaw> {
    return await this.worker.call("infer", data.data);
  }

  override async rawToResult(
    input: Yolov8InputType,
    output: Yolov8SegmentationResultRaw
  ): Promise<Yolov8SegmentationResult> {
    const processed = (
      await pythonUtils.get("format_seg_results").callAsync(
        [output.out1, output.dims1],
        [output.out2, output.dims2],
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
