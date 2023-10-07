"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib_1 = require("./lib");
const tensor = new lib_1.XArrayDouble([0.505, 2, 3, 4, 5, 6], [2, 2]);
console.log("Shape", tensor.shape());
console.log("Data", tensor.toArray());
//# sourceMappingURL=index.js.map