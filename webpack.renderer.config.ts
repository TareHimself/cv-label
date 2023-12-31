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
      "@redux": path.resolve(__dirname, path.join("src", "frontend", "redux")),
      "@hooks": path.resolve(__dirname, path.join("src", "frontend", "hooks")),
      "@components": path.resolve(
        __dirname,
        path.join("src", "frontend", "components")
      ),
      "@frontend": path.resolve(__dirname, path.join("src", "frontend")),
      "@root": path.resolve(__dirname, path.join("src")),
      "@types": path.resolve(__dirname, path.join("src", "types.ts")),
    },
  },
  externals: buildExternalsObject(externals)
  // optimization: {
  //   minimize: false
  // }
};
