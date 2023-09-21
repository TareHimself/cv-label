// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { ipcRenderer } from "../ipc-impl";

const exposedApi = ipcRenderer.exposeApi("bridge", {
    getPreloadPath: () => ipcRenderer.sendSync("getPreloadPath"),
    windowMinimize: () => {
        ipcRenderer.sendAsync("windowMinimize");
    },
    windowMaximize: () => {
        ipcRenderer.sendAsync("windowMaximize");
    },
    windowClose: () => {
        ipcRenderer.sendAsync("windowClose");
    },
    getPlatform: (...args) => ipcRenderer.sendSync('getPlatform',...args),
    isDev: (...args) => ipcRenderer.sendSync('isDev',...args),
    selectModel: (...args) => ipcRenderer.sendAsync('selectModel',...args),
    loadModel: (...args) => ipcRenderer.sendAsync('loadModel',...args),
    getModel: (...args) => ipcRenderer.sendSync('getModel',...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doInference: (...args) => ipcRenderer.sendAsync('doInference',...args) as any // YES I KNOW THIS IS A SIN, FOGIVE ME
})

declare global {
  interface Window {
    bridge: typeof exposedApi;
  }
}