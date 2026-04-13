
import { SampleImporter } from "./SampleImporter";
import { FilesSampleImporter } from "./FilesSampleImporter";
import { CocoSegmentationImporter } from "./CocoSegmentationImporter";

export const Importers: SampleImporter[] = [
    new FilesSampleImporter(),
    new CocoSegmentationImporter()
]