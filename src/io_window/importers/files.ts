import { INewSample, PluginFolderOrFileOption, PluginOption, PluginOptionResult, PluginOptionResultMap } from "@types";
import { ComputerVisionImporter } from ".";

export class FilesImporter extends ComputerVisionImporter {
  constructor() {
    super("Files");
    // this.id = "files";
  }

  getOptions(): PluginOption[] {
    return [{
      id: "files",
      displayName: "Files",
      type: 'fileSelect',
      multiple: true
    }]
  }

  override async import(options: PluginOptionResultMap): Promise<INewSample[]> {

    const filesOption = options['files'] as (PluginOptionResult<'fileSelect'> | undefined)

    if(!filesOption || filesOption.type !== 'fileSelect'){
      return [];
    }

    // const dialogResult = await dialog.showOpenDialog({
    //   title: "Select Files To Add To Project",
    //   properties: ["multiSelections", "openFile"],
    // });

    
    return filesOption.value.map((a) => {
      return {
        path: a,
        annotations: [],
      };
    });
  }
}
