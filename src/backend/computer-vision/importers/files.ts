import { ISample } from "@types";
import { ComputerVisionImporter } from ".";
import { dialog } from "electron";
import { sqliteNow } from "@root/utils";

export class FilesImporter extends ComputerVisionImporter {
  constructor() {
    super("Files");
    // this.id = "files";
  }

  override async import(): Promise<ISample[]> {
    const dialogResult = await dialog.showOpenDialog({
      properties: ["multiSelections", "openFile"],
    });

    if (dialogResult.filePaths.length === 0) {
      return [];
    }

    return dialogResult.filePaths.map((a) => {
      return {
        path: a,
        labels: [],
        added: sqliteNow(),
      };
    });
  }
}
