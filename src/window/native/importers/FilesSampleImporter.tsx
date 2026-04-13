import { INewSample,  IPluginOption,  PluginOptionResultMap } from "@types";
import { SampleImporter } from "./SampleImporter";
import { FileSelectPluginOption } from "@components/PluginOptionComponents/FileSelectPluginOption";


export class FilesSampleImporter extends SampleImporter {
  getName(): string {
      return "Files"
  }
  getId(): string {
      return "TareHimself/FileSampleImporter"
  }

  getOptions(): IPluginOption[] {
    return [{
      id: "files",
      title: "Select Files",
      component: (props) => <FileSelectPluginOption {...props} multiple />,
      defaultValue: []
    }]
  }

  override async import(options: PluginOptionResultMap): Promise<INewSample[]> {

    const files = options['files'] as string[]

    // const dialogResult = await dialog.showOpenDialog({
    //   title: "Select Files To Add To Project",
    //   properties: ["multiSelections", "openFile"],
    // });

    return files.map((a) => {
      return {
        path: a,
        annotations: [],
      };
    });
  }
}