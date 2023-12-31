// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { ioToMain } from "../ipc-impl";

const exposedApi = ioToMain.exposeApi("ioBridge", {});

declare global {
  interface Window {
    ioBridge: typeof exposedApi;
  }
}
