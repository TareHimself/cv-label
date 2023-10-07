/* eslint-disable @typescript-eslint/no-var-requires */
export type XArrayType = "float" | "int" | "double";

type AddDim<T extends number> = T[];

export declare class Tensor {
  constructor();
  constructor(data: number[]);
  constructor(data: number[], shape: number[]);

  shape: () => number[];

  toArray: () => number[];

  view: (view: number[]) => Tensor;
}

module.exports = require("../build/Release/addon");
