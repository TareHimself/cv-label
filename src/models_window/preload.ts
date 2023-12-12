// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { modelsToMain } from "../ipc-impl";

const exposedApi = modelsToMain.exposeApi("backendModels", {});

declare global {
  interface Window {
    backendModels: typeof exposedApi;
  }
}
