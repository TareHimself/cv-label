// import { ProcessController, createProcess } from "@root/backend/worker";
// import { ECVModelType } from "@types";
// import { InferenceSession } from "onnxruntime-node";

// export type YoloWorkerEvents<PythonResult> = {
//   predict: (
//     imagePath: string,
//     inferenceDims: {
//       x: number;
//       y: number;
//     }
//   ) => Promise<PythonResult>;
// };

// export type DetectionWorkerEvents = YoloWorkerEvents<{
//   boxes: number[][];
// }>;

// export type SegmentationWorkerEvents = YoloWorkerEvents<{
//   boxes: number[][];
//   masks: [number, number][][];
// }>;

// export type YoloV8WorkerProcess<
//   Model extends ECVModelType.Yolov8Detect | ECVModelType.Yolov8Seg
// > = ProcessController<
//   Model extends ECVModelType.Yolov8Detect
//     ? DetectionWorkerEvents
//     : SegmentationWorkerEvents
// >;

// function test2() {
//   console.log("SHIT IT WORKS");
// }

// function test() {
//   test2();
// }

// export function createDetectionWorker(
//   modelPath: string
// ): Promise<YoloV8WorkerProcess<ECVModelType.Yolov8Detect>> {
//   return createProcess(
//     async (bridge, modelPath, mainCwd, funcs) => {
//       process.chdir(mainCwd);

//       const [{ InferenceSession, Tensor }, sharp, torch] = eval(
//         `[require("onnxruntime-node"),require("sharp"),require("@nodeml/torch")]`
//       ) as [
//         typeof import("onnxruntime-node"),
//         typeof import("sharp"),
//         typeof import("@nodeml/torch")
//       ];

//       const opts: InferenceSession.SessionOptions = {
//         executionProviders: ["cpu"],
//       };

//       const session = await InferenceSession.create(modelPath, opts);

//       /** UTILITY FUNCTIONS */
//       const [test1, test2] = [eval(funcs[0]), eval(funcs[1])];

//       test2();
//       /** UTILITY FUNCTIONS */

//       bridge.handleEvent("predict", async (imagePath, inferenceDims) => {
//         try {
//           const img = sharp(imagePath);

//           const meta = await img.metadata();
//           const [img_width, img_height] = [meta.width, meta.height];

//           const pixels = await img
//             .removeAlpha()
//             .resize({ width: 640, height: 640, fit: "contain" }) // Yolo pads to maintain aspect ratio
//             .raw()
//             .toBuffer();

//           const red: number[] = [],
//             green: number[] = [],
//             blue: number[] = [];

//           for (let index = 0; index < pixels.length; index += 3) {
//             red.push(pixels[index] / 255.0);
//             green.push(pixels[index + 1] / 255.0);
//             blue.push(pixels[index + 2] / 255.0);
//           }

//           const data = Float32Array.from([...red, ...green, ...blue]);

//           const inputDims = {
//             width: img_width ?? -1,
//             height: img_height ?? -1,
//           };

//           const input = new Tensor(data, [1, 3, 640, 640]);

//           const outputs = await session.run({ images: input });

//           const output = outputs["output0"];

//           const out1 = Array.from(output.data as Float32Array);
//           const out1Dims = [...output.dims];

//           const tensorOutput = torch.tensor(output.data as Float32Array, [
//             ...output.dims,
//           ]);

//           console.log("Tensor Shape", tensorOutput.shape);

//           // return (
//           //   await pythonUtils
//           //     .get("format_detect_result")
//           //     .callAsync(
//           //       [out1, out1Dims],
//           //       [inputDims.width, inputDims.height],
//           //       [inferenceDims.x, inferenceDims.y]
//           //     )
//           // ).toJS();
//           return {
//             boxes: [],
//           };
//         } catch (error) {
//           console.error(error);
//           return {
//             boxes: [],
//           };
//         }
//       });
//     },
//     modelPath,
//     process.cwd(),
//     [test.toString(), test2.toString()]
//   );
// }
