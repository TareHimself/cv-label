import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/frontend/index.html",
            js: "./src/frontend/renderer.ts",
            name: "main_window",
            preload: {
              js: "./src/backend/preload.ts",
            },
          },
        ],
        // nodeIntegration: true,
      },
      packageSourceMaps: true,
      devContentSecurityPolicy: `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: * blob: app:; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: * app: blob:; media-src 'self' 'unsafe-inline' 'unsafe-eval' data: * app:;`,
    })
  ],
};

export default config;
