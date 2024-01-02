// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { rendererToMain } from "../ipc-impl";

const exposedApi = rendererToMain.exposeApi("bridge", {
  getPreloadPath: () => rendererToMain.sendSync("getPreloadPath"),
  windowMinimize: (...args) => rendererToMain.sendSync("windowMinimize", ...args),
  windowMaximize: (...args) => rendererToMain.sendSync("windowMaximize", ...args),
  windowClose: (...args) => rendererToMain.sendSync("windowClose", ...args),
  getPlatform: (...args) => rendererToMain.sendSync("getPlatform", ...args),
  isDev: (...args) => rendererToMain.sendSync("isDev", ...args),
  selectModel: (...args) => rendererToMain.sendAsync("selectModel", ...args),
  loadModel: (...args) => rendererToMain.sendAsync("loadModel", ...args),
  doInference: (...args) => rendererToMain.sendAsync("doInference", ...args),
  unloadModel: (...args) => rendererToMain.sendAsync("unloadModel", ...args),
  getSupportedModels: (...args) => rendererToMain.sendAsync("getSupportedModels", ...args),
  importSamples: (...args) => rendererToMain.sendAsync("importSamples", ...args),
  getExporters: (...args) => rendererToMain.sendAsync("getExporters", ...args),
  getImporters: (...args) => rendererToMain.sendAsync("getImporters", ...args),
  createProject: (...args) => rendererToMain.sendAsync("createProject", ...args),
  getSample: (...args) => rendererToMain.sendAsync('getSample', ...args),
  getSampleIds: (...args) => rendererToMain.sendAsync('getSampleIds', ...args),
  activateProject: (...args) => rendererToMain.sendAsync('activateProject', ...args),
  createAnnotations: (...args) => rendererToMain.sendAsync("createAnnotations", ...args),
  updateAnnotations: (...args) => rendererToMain.sendAsync("updateAnnotations", ...args),
  removeAnnotations: (...args) => rendererToMain.sendAsync("removeAnnotations", ...args),
  createPoints: (...args) => rendererToMain.sendAsync("createPoints", ...args),
  updatePoints: (...args) => rendererToMain.sendAsync("updatePoints", ...args),
  removePoints: (...args) => rendererToMain.sendAsync("removePoints", ...args),
  saveImage: (...args) => rendererToMain.sendAsync('saveImage',...args)
});

declare global {
  interface Window {
    bridge: typeof exposedApi;
  }
}
