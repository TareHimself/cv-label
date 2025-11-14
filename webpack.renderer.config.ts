import type { Configuration } from "webpack";

import path from "path";
import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";
import { buildExternalsObject } from "./webpack.utils";
import { externals } from "./webpack.constants";

rules.push({
  test: /\.css$/,
  use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
    alias: {
      "@hooks": path.resolve(__dirname, path.join("src", "window", "hooks")),
      "@components": path.resolve(
        __dirname,
        path.join("src", "window", "components")
      ),
      "@window": path.resolve(__dirname, path.join("src", "window")),
      "@root": path.resolve(__dirname, path.join("src")),
      "@types": path.resolve(__dirname, path.join("src", "types.ts")),
    },
  },
  externals: buildExternalsObject(externals)
  // optimization: {
  //   minimize: false
  // }
};
