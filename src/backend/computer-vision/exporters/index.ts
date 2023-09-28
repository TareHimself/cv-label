import { ISample } from "@types";
import { v4 as uuidv4 } from "uuid";

export class ComputerVisionExporter {
  name: string;
  id: string;

  constructor(name: string) {
    this.name = name;
    this.id = uuidv4();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async export(samples: ISample[]): Promise<boolean> {
    throw new Error("Exporter not implemented");
  }
}
