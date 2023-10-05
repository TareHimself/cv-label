/* eslint-disable @typescript-eslint/no-var-requires */
export type XArrayType = "float" | "int" | "double";

declare class XArray<T extends XArrayType = XArrayType> {
  constructor();
  constructor(data: number[]);
  constructor(data: number[], shape: number[]);

  shape: () => number[];

  toArray: () => number[];
}

export declare class XArrayInt extends XArray<"int"> {}

export declare class XArrayFloat extends XArray<"float"> {}

export declare class XArrayDouble extends XArray<"double"> {}

module.exports = require("../build/Release/addon");
