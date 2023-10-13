// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { ipcRenderer } from "../ipc-impl";

const exposedApi = ipcRenderer.exposeApi("bridge", {
  getPreloadPath: () => ipcRenderer.sendSync("getPreloadPath"),
  windowMinimize: () => {
    ipcRenderer.sendSync("windowMinimize");
  },
  windowMaximize: () => {
    ipcRenderer.sendSync("windowMaximize");
  },
  windowClose: () => {
    ipcRenderer.sendSync("windowClose");
  },
  getPlatform: (...args) => ipcRenderer.sendSync("getPlatform", ...args),
  isDev: (...args) => ipcRenderer.sendSync("isDev", ...args),
  selectModel: (...args) => ipcRenderer.sendAsync("selectModel", ...args),
  loadModel: (...args) => ipcRenderer.sendAsync("loadModel", ...args),
  getModel: (...args) => ipcRenderer.sendSync("getModel", ...args),
  doInference: (...args) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.sendAsync("doInference", ...args) as any, // YES I KNOW THIS IS A SIN, FOGIVE ME
  importSamples: (...args) => ipcRenderer.sendAsync("importSamples", ...args),
  unloadModel: (...args) => ipcRenderer.sendAsync("unloadModel", ...args),
  getExporters: (...args) => ipcRenderer.sendAsync("getExporters", ...args),
  getSupportedModels: (...args) =>
    ipcRenderer.sendAsync("getSupportedModels", ...args),
  getImporters: (...args) => ipcRenderer.sendAsync("getImporters", ...args),
  createProject: (...args) => ipcRenderer.sendAsync("createProject", ...args),
});

declare global {
  interface Window {
    bridge: typeof exposedApi;
  }
}
