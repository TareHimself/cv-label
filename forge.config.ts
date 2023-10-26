import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import { } from '@electron-forge/shared-types';
import ExternalsPlugin from "./externals";
const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "**/*.dll"
    }
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
        nodeIntegration: true,
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
    }),
    new ExternalsPlugin({
      externals: ["sharp","@nodeml/torch","@nodeml/opencv"]
    }),
    // new ForgeExternalsPlugin({
    //   externals: ["sharp", "@nodeml/torch", "@nodeml/opencv"],
    //   includeDeps: true
    // })
    
  ],
  

};

export default config;
