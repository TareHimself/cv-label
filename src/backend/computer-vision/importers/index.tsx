import { ISample } from "@types";

export class ComputerVisionImporter {
  name: string;

  static ALL_IMPORTERS: ComputerVisionImporter[] = [];

  constructor(name: string) {
    this.name = name;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async import(): Promise<ISample[]> {
    throw new Error("Importer not implemented");
  }
}
