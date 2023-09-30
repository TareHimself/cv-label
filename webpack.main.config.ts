import type { Configuration } from "webpack";

import path from "path";
import { rules } from "./webpack.rules";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeExternals = require("webpack-node-externals");

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/backend/index.ts",
  // Put your normal webpack config below here
  module: {
    rules,
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
    alias: {
      "@root": path.resolve(__dirname, path.join("src")),
      "@types": path.resolve(__dirname, path.join("src", "types.ts")),
    },
  },
  // externals: {
  //   electron: "commonjs2 electron",
  // },
    externals: [
      nodeExternals(),
  ],
  // optimization: {
  //   minimize: false,
  // },
};
