// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { modelsToMain } from "../ipc-impl";

const exposedApi = modelsToMain.exposeApi("modelsBridge", {});

declare global {
  interface Window {
    modelsBridge: typeof exposedApi;
  }
}
