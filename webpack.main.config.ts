import type { Configuration } from "webpack";

import path from "path";
import { rules } from "./webpack.rules";
import { buildExternalsObject } from "./webpack.utils";
import { externals } from "./webpack.constants";
export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main/index.ts",
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
  externals: buildExternalsObject(externals),
  optimization: {
    minimize: false,
  },
};
