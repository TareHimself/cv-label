/* eslint-disable @typescript-eslint/ban-types */
import { IpcRendererTyped, IpcMainTyped } from "./ipc";
import { IMainToRendererEvents, IMainToModelsEvents, IRendererToMainEvents, IMainToIoEvents } from "./types";

export const rendererToMain = new IpcRendererTyped<
  IRendererToMainEvents,
  IMainToRendererEvents
>();

export const mainToRenderer = new IpcMainTyped<
  IRendererToMainEvents,
  IMainToRendererEvents
>();

export const modelsToMain = new IpcRendererTyped<
  {},
  IMainToModelsEvents
>();

export const mainToModels = new IpcMainTyped<
  {},
  IMainToModelsEvents
>();

export const ioToMain = new IpcRendererTyped<
  {},
  IMainToIoEvents
>();

export const mainToIo = new IpcMainTyped<
  {},
  IMainToIoEvents
>();
