const testModule = require("./build/Release/addon");

const {XArray } = testModule
console.log((new XArray([1,2,3,4],[2,2])).shape());
