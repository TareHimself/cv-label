/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { Tensor } from "./lib";
console.log("Creating");
const tensor = new Tensor([0.505, 2, 3, 4, 5, 6]);
console.log("Created");
console.log("Shape", tensor.shape());
console.log("Data", tensor.view([2, 3]).toArray());
console.log("Data2", tensor.toArray());
