import createLogger from '@root/logger';
import { getProjectsPath } from "@root/utils";
createLogger('models');

import ComputerVisionModel from "@root/models_window/models";
import { Yolov8Detection, Yolov8Segmentation } from "@root/models_window/models/yolo";

import path from 'path';
import { v4 as uuidv4 } from 'uuid'

interface IDetectorInfo {
    id: string;
    name: string;
    create: () => Promise<ComputerVisionModel>
}

let detector: ComputerVisionModel | undefined = undefined;


const DETECTORS: IDetectorInfo[] = [{
        id: uuidv4(),
        name: "Yolov8 Detection",
        create: Yolov8Detection.create
    },
    {
        id: uuidv4(),
        name: "Yolov8 Segmentation",
        create: Yolov8Segmentation.create
    }
]

window.modelsBridge.handle("doInference", async (imagePath) => {
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

window.modelsBridge.handle("loadModel", async (modelId) => {
    try {
        if (detector !== undefined) {
            detector?.cleanup();
            detector = undefined;
        }

        detector = await DETECTORS.find(c => c.id === modelId)?.create()

        return detector !== undefined;
    } catch (error) {
        console.error(error);
        return false;
    }
});

window.modelsBridge.handle("unloadModel", async () => {
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

window.modelsBridge.handle("getSupportedModels", async () => {
    
    return DETECTORS.map((a) => ({
        id: a.id,
        displayName: a.name,
    }));
});