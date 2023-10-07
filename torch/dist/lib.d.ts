export type XArrayType = "float" | "int" | "double";
export declare class Tensor {
    constructor();
    constructor(data: number[]);
    constructor(data: number[], shape: number[]);
    shape: () => number[];
    toArray: () => number[];
    view: (view: number[]) => Tensor;
}
