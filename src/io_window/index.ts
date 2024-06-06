import createLogger from '@root/logger';
createLogger('io');
import { YoloV8Importer } from "./importers/yolov8";
import { CocoSegmentationImporter } from "./importers/coco";
import { FilesImporter } from "./importers/files";
import { ComputerVisionExporter } from "./exporters";
import { ComputerVisionImporter } from "./importers";
import path from "path";
import { getProjectsPath } from '@root/utils';
import { Yolov8Exporter } from './exporters/yolov8';


const IMPORTERS: ComputerVisionImporter[] = [
    new YoloV8Importer(),
    new CocoSegmentationImporter(),
    new FilesImporter(),
];

const EXPORTERS: ComputerVisionExporter[] = [
    new Yolov8Exporter(),
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.ioBridge.handle("importSamples", async (projectId, importerId,options) => {
    return (
        (await IMPORTERS.find((a) => a.id === importerId)?.importIntoProject(
        projectId,options
        )) ?? []
    );
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.ioBridge.handle("exportSamples", async (projectId, exporterId) => {
    console.log("Exporting")
    return (
        (await EXPORTERS.find((a) => a.id === exporterId)?.export(
        projectId,
        path.join(getProjectsPath(), projectId)
        )) ?? 0
    );
});

window.ioBridge.handle("getImporters", async () => {
    console.log("Returning importers")
    return IMPORTERS.map((a) => ({
        id: a.id,
        displayName: a.name,
        options: a.getOptions()
    }));
});

window.ioBridge.handle("getExporters", async () => {
    return EXPORTERS.map((a) => ({
        id: a.id,
        displayName: a.name,
        options: a.getOptions()
    }));
});