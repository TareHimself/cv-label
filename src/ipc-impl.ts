import { IpcRendererTyped, IpcMainTyped } from "./ipc";
import { IMainToRendererEvents, IRendererToMainEvents } from "./types";

export const ipcRenderer = new IpcRendererTyped<
  IRendererToMainEvents,
  IMainToRendererEvents
>();

export const ipcMain = new IpcMainTyped<
  IRendererToMainEvents,
  IMainToRendererEvents
>();
