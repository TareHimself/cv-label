import { app, BrowserWindow, protocol, systemPreferences } from "electron";
import { Yolov8Detection, Yolov8Segmentation } from "./computer-vision/yolo";
import * as fs from "fs";
import { ipcMain } from "../ipc-impl";
import { GenericComputerVisionModel } from "./computer-vision";
import { ECVModelType, InferenceResult, ValueOf } from "../types";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

ipcMain.handle("getPreloadPath", () => MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY);
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = async () => {
  protocol.handle("app", async (req) => {
    const { host, pathname } = new URL(req.url);

    console.log("Handling protocol", host, pathname);
    if (host === "file") {
      return new Response(
        await fs.promises.readFile(decodeURI(pathname.slice(1))),
        {}
      );
    }

    return new Response(undefined, {
      status: 404,
    });
  });

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
    autoHideMenuBar: true,
  });

  mainWindow.setMenu(null);

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); //https://github.com/TareHimself/manga-translator/raw/master/assets/examples/solo_leveling.png

let detector: GenericComputerVisionModel | undefined = undefined;

ipcMain.handle("doInference", async (_modelType, imagePath) => {
  if (!detector) {
    console.error("Inference was attempted with no model");
    return undefined;
  }

  try {
    return (await detector.predict(imagePath)) as any;
  } catch (error) {
    console.error(error);
    return undefined;
  }
});

const POSSIBLE_DETECTORS: Record<
  ValueOf<typeof ECVModelType>,
  (modelPath: string) => Promise<GenericComputerVisionModel>
> = {
  [ECVModelType.Yolov8Detect]: (...args) => Yolov8Detection.create(...args),
  [ECVModelType.Yolov8Seg]: (...args) => Yolov8Segmentation.create(...args),
};

ipcMain.handle("loadModel", async (modelType, modelPath) => {
  try {
    detector = await POSSIBLE_DETECTORS[modelType](modelPath);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
