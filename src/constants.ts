import { ECVModelType, ValueOf } from "./types";


export const computerVisionModelNames: Record<ValueOf<typeof ECVModelType>,string> = {
    [ECVModelType.Yolov8Detect]: "Yolov8 Detection",
    [ECVModelType.Yolov8Seg]: "Yolov8 Segmentation"
}