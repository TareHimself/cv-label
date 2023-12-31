import createLogger from '@root/logger';
createLogger('io');
import { YoloV8Importer } from "./importers/yolov8";
import { CocoSegmentationImporter } from "./importers/coco";
import { FilesImporter } from "./importers/files";
import { ComputerVisionExporter } from "./exporters";
import { ComputerVisionImporter } from "./importers";


const IMPORTERS: ComputerVisionImporter[] = [
    new YoloV8Importer(),
    new CocoSegmentationImporter(),
    new FilesImporter(),
];

const EXPORTERS: ComputerVisionExporter[] = [];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.ioBridge.handle("importSamples", async (projectId, importerId) => {
    return (
        (await IMPORTERS.find((a) => a.id === importerId)?.importIntoProject(
        projectId
        )) ?? []
    );
});

window.ioBridge.handle("getImporters", async () => {
    console.log("Returning importers")
    return IMPORTERS.map((a) => ({
        id: a.id,
        displayName: a.name,
    }));
});

window.ioBridge.handle("getExporters", async () => {
    return EXPORTERS.map((a) => ({
        id: a.id,
        displayName: a.name,
    }));
});