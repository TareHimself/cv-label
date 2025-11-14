import { PluginOption } from "@types";
import { v4 as uuidv4 } from "uuid";
import { IActiveProject } from "../project";

export class ComputerVisionExporter {
  name: string;
  id: string;

  constructor(name: string) {
    this.name = name;
    this.id = uuidv4();
  }

  getOptions(): PluginOption[]{
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async export(project: IActiveProject): Promise<number> {
    throw new Error("Exporter not implemented");
  }
}
