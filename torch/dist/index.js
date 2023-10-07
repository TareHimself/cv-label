"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib_1 = require("./lib");
console.log("Creating");
const tensor = new lib_1.Tensor([0.505, 2, 3, 4, 5, 6]);
console.log("Created");
console.log("Shape", tensor.shape());
console.log("Data", tensor.view([2, 3]).toArray());
console.log("Data2", tensor.toArray());
//# sourceMappingURL=index.js.map