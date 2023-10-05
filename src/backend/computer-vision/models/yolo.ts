import { InferenceSession } from "onnxruntime-node";
import ComputerVisionModel from ".";
import {
  CvBoxLabel,
  CvSegmentLabel,
  ECVModelType,
  ELabelType,
  ICVModelInferenceResults,
} from "@types";
import { ProcessController, createProcess } from "@root/backend/worker";

export type Yolov8InputType = {
  data: number[];
  width: number;
  height: number;
};

type YoloWorkerEvents<PythonResult> = {
  predict: (
    imagePath: string,
    inferenceDims: {
      x: number;
      y: number;
    }
  ) => Promise<PythonResult>;
};

type DetectionWorkerEvents = YoloWorkerEvents<{
  boxes: number[][];
}>;

type SegmentationWorkerEvents = YoloWorkerEvents<{
  boxes: number[][];
  masks: [number, number][][];
}>;

type YoloV8WorkerProcess<
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> = ProcessController<
  Model extends ECVModelType.Yolov8Detect
    ? DetectionWorkerEvents
    : SegmentationWorkerEvents
>;
abstract class Yolov8<
  Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
> extends ComputerVisionModel<
  Model extends ECVModelType.Yolov8Detect ? CvBoxLabel[] : CvSegmentLabel[],
  Model
> {
  worker: YoloV8WorkerProcess<Model>;
  constructor(modelId: Model, model: YoloV8WorkerProcess<Model>) {
    super(modelId);
    this.worker = model;
  }

  static getSessionOptions() {
    const opts: InferenceSession.SessionOptions = {
      executionProviders: ["cpu"],
    };
    return opts;
  }

  override async cleanup(): Promise<void> {
    await this.worker.stop();
  }
}

type Yolov8DetectionResult =
  ICVModelInferenceResults[ECVModelType.Yolov8Detect];

export class Yolov8Detection extends Yolov8<ECVModelType.Yolov8Detect> {
  constructor(model: YoloV8WorkerProcess<ECVModelType.Yolov8Detect>) {
    super(ECVModelType.Yolov8Detect, model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Detection(
      await createProcess(
        async (bridge, options, modelPath, mainCwd) => {
          const [{ InferenceSession, Tensor }, { pymport, proxify }, sharp] =
            eval(
              `[require("onnxruntime-node"),require("pymport"),require("sharp")]`
            ) as [
              typeof import("onnxruntime-node"),
              typeof import("pymport"),
              typeof import("sharp")
            ];

          const pythonSys = proxify(pymport("sys"));
          pythonSys.get("path").insert(0, mainCwd);
          console.log("CWD", mainCwd);
          const pythonUtils = proxify(pymport("py_utils"));

          const session = await InferenceSession.create(modelPath, options);

          bridge.handleEvent("predict", async (imagePath, inferenceDims) => {
            try {
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

              const input = new Tensor(data, [1, 3, 640, 640]);

              const outputs = await session.run({ images: input });

              const output = outputs["output0"];

              const out1 = Array.from(output.data as Float32Array);
              const out1Dims = [...output.dims];

              return (
                await pythonUtils
                  .get("format_detect_result")
                  .callAsync(
                    [out1, out1Dims],
                    [inputDims.width, inputDims.height],
                    [inferenceDims.x, inferenceDims.y]
                  )
              ).toJS();
            } catch (error) {
              console.error(error);
              return {
                boxes: [],
              };
            }
          });
        },
        Yolov8.getSessionOptions(),
        modelPath,
        process.cwd()
      )
    );
  }

  override async handlePredict(imagePath: string): Promise<CvBoxLabel[]> {
    const result = await this.worker.call(
      "predict",
      imagePath,
      Yolov8Detection.inferenceDims
    );

    const allBoxes: Yolov8DetectionResult = result.boxes.map((a) => {
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

    return allBoxes.map((c) => {
      return {
        x1: c.x1,
        y1: c.y1,
        x2: c.x2,
        y2: c.y2,
        type: ELabelType.BOX,
        classIndex: c.class,
      };
    });
  }
}

export class Yolov8Segmentation extends Yolov8<ECVModelType.Yolov8Seg> {
  constructor(model: YoloV8WorkerProcess<ECVModelType.Yolov8Seg>) {
    super(ECVModelType.Yolov8Seg, model);
  }

  static inferenceDims = {
    x: 640,
    y: 640,
  };

  static async create(modelPath: string) {
    return new Yolov8Segmentation(
      await createProcess(
        async (bridge, options, modelPath, mainCwd) => {
          const [{ InferenceSession, Tensor }, { pymport, proxify }, sharp] =
            eval(
              `[require("onnxruntime-node"),require("pymport"),require("sharp")]`
            ) as [
              typeof import("onnxruntime-node"),
              typeof import("pymport"),
              typeof import("sharp")
            ];

          const session = await InferenceSession.create(modelPath, options);

          const pythonSys = proxify(pymport("sys"));
          pythonSys.get("path").insert(0, mainCwd);
          const pythonUtils = proxify(pymport("py_utils"));

          bridge.handleEvent("predict", async (imagePath, inferenceDims) => {
            try {
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

              const input = new Tensor(data, [1, 3, 640, 640]);

              const outputs = await session.run({ images: input });

              const [out1, out1Dims, out2, out2Dims] = [
                Array.from(outputs["output0"].data as Float32Array),
                outputs["output0"].dims,
                Array.from(outputs["output1"].data as Float32Array),
                outputs["output1"].dims,
              ];

              return (
                await pythonUtils
                  .get("format_seg_results")
                  .callAsync(
                    [out1, out1Dims],
                    [out2, out2Dims],
                    [inputDims.width, inputDims.height],
                    [inferenceDims.x, inferenceDims.y]
                  )
              ).toJS();
            } catch (error) {
              console.error(error);
              return {
                boxes: [],
                masks: [],
              };
            }
          });
        },
        Yolov8.getSessionOptions(),
        modelPath,
        process.cwd()
      )
    );
  }

  override async handlePredict(imagePath: string): Promise<CvSegmentLabel[]> {
    const result = await this.worker.call(
      "predict",
      imagePath,
      Yolov8Segmentation.inferenceDims
    );

    return result.boxes
      .map((a, idx) => {
        return {
          x1: a[0],
          y1: a[1],
          x2: a[2],
          y2: a[3],
          class: a[4],
          confidence: a[5],
          mask: result.masks[idx],
        };
      })
      .sort((box1, box2) => box2.confidence - box1.confidence)
      .map((c) => {
        return {
          points: c.mask,
          classIndex: c.class,
          type: ELabelType.SEGMENT,
        };
      });
  }
}
