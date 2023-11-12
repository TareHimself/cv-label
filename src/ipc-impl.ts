/* eslint-disable @typescript-eslint/ban-types */
import { IpcRendererTyped, IpcMainTyped } from "./ipc";
import { IMainToRendererEvents, IMainToModelsBackendEvents, IRendererToMainEvents } from "./types";

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
  IMainToModelsBackendEvents
>();

export const mainToModels = new IpcMainTyped<
  {},
  IMainToModelsBackendEvents
>();
