import { INewSample } from "@types";
import { ComputerVisionImporter } from ".";
import { dialog } from "@electron/remote";

export class FilesImporter extends ComputerVisionImporter {
  constructor() {
    super("Files");
    // this.id = "files";
  }

  override async import(): Promise<INewSample[]> {
    const dialogResult = await dialog.showOpenDialog({
      title: "Select Files To Add To Project",
      properties: ["multiSelections", "openFile"],
    });

    if (dialogResult.filePaths.length === 0) {
      return [];
    }

    return dialogResult.filePaths.map((a) => {
      return {
        path: a,
        annotations: [],
      };
    });
  }
}
