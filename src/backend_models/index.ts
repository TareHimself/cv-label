import { GenericComputerVisionModel } from "@root/backend_models/models";
import { Yolov8Detection, Yolov8Segmentation } from "@root/backend_models/models/yolo";
import { getProjectsPath } from "@root/utils";
import { ValueOf, ECVModelType } from "@types";
import path from 'path';


let detector: GenericComputerVisionModel | undefined = undefined;
let detectorModelPath = "";

const POSSIBLE_DETECTORS: Record<
    ValueOf<typeof ECVModelType>,
    {
        id: ValueOf<typeof ECVModelType>;
        name: string;
        create: (modelPath: string) => Promise<GenericComputerVisionModel>;
    }
> = {
    [ECVModelType.Yolov8Detect]: {
        id: ECVModelType.Yolov8Detect,
        name: "Yolov8 Detection",
        create: (...args) => Yolov8Detection.create(...args),
    },
    [ECVModelType.Yolov8Seg]: {
        id: ECVModelType.Yolov8Seg,
        name: "Yolo8 Segmentation",
        create: (...args) => Yolov8Segmentation.create(...args),
    },
};

window.backendModels.handle("doInference", async (_modelType, imagePath) => {
    if (!detector) {
        console.error("Inference was attempted with no model");
        return undefined;
    }

    try {
        console.time("Inference Time Total")
        const result = await detector.predict(path.normalize(path.join(getProjectsPath(), imagePath)));
        console.timeEnd("Inference Time Total")
        return result
    } catch (error) {
        console.error(error);
        return undefined;
    }
});

window.backendModels.handle("loadModel", async (modelType, modelPath) => {
    try {
        if (detector?.modelType !== modelType || detectorModelPath !== modelPath) {
            detector?.cleanup();
            detectorModelPath = modelPath;
            detector = await POSSIBLE_DETECTORS[modelType].create(modelPath);
        }
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
});

window.backendModels.handle("unloadModel", async () => {
    try {
        if (detector) {
            const oldDetector = detector;
            detector = undefined;
            await oldDetector.cleanup();
            return true;
        }
    } catch (error) {
        console.error(error);
    }

    return false;
});

window.backendModels.handle("getSupportedModels", async () => {
    return Object.values(POSSIBLE_DETECTORS).map((a) => ({
        id: a.id as unknown as string,
        displayName: a.name,
    }));
});