import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import path from 'path';
import { runCommandAt } from "./webpack.utils";

const config: ForgeConfig = {
  packagerConfig: {
    // asar: {
    //   // unpack: "**/*.dll"
    //   unpack: "*"
    // }
    asar: false,
    afterComplete: [(buildPath: string,
      electronVersion: string,
      platform: string,
      arch: string,
      callback: (err?: Error | null) => void) => {
      // fs.writeFileSync('zz.txt',buildPath)
      const commandPath = path.join(buildPath, 'resources', 'app')

      runCommandAt("npm install", commandPath).then(() => {
        runCommandAt("npm prune --omit=dev", commandPath).then(() => {
          callback()
        }).catch((e) => callback(new Error(e)))
      }).catch((e) => callback(new Error(e)))
    }]
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [

    //new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      devServer: { liveReload: false },
      renderer: {
        config: rendererConfig,
        nodeIntegration: true,
        entryPoints: [
          {
            html: "./src/window/index.html",
            js: "./src/window/renderer.ts",
            name: "main_window",
            preload: {
              js: "./src/window/preload.ts",
            },
          },
          // {
          //   html: "./src/models_window/index.html",
          //   js: "./src/models_window/index.ts",
          //   name: "models_window",
          //   preload: {
          //     js: "./src/models_window/preload.ts",
          //   },
          // },
          // {
          //   html: "./src/io_window/index.html",
          //   js: "./src/io_window/index.ts",
          //   name: "io_window",
          //   preload: {
          //     js: "./src/io_window/preload.ts",
          //   },
          // },
        ],
      },
      packageSourceMaps: true,
      devContentSecurityPolicy: `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: * blob: app:; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: * app: blob:; media-src 'self' 'unsafe-inline' 'unsafe-eval' data: * app:;`,
    }),
    // new ExternalsPlugin({
    //   externals: Object.keys(buildExternalsObject(externals))
    // }),
    // new ForgeExternalsPlugin({
    //   externals: ["sharp", "@nodeml/torch", "@nodeml/opencv"],
    //   includeDeps: true
    // })

  ],


};

export default config;
