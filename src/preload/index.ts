import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IDataStore, ISystem, IZip } from '../shared/types'
import { LocalStoreKeys, SystemKeys, ZipKeys } from '../shared/ipcKeys'
import { checkBoundryResult } from '../shared/utils'

// Custom APIs for renderer
const localStoreApi: IDataStore = {
  connect: (...args) => checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.Connect, ...args)),
  disconnect: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.Disconnect, ...args)),

  getProjects: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.GetProjects, ...args)),
  createProject: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.CreateProject, ...args)),
  deleteProjects: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.DeleteProjects, ...args)),

  getTasksForProject: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.GetTasks, ...args)),
  createTask: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.CreateTask, ...args)),
  deleteTasks: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.DeleteTasks, ...args)),

  getSamplesForTask: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.GetSamplesForTask, ...args)),
  getSamples: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.GetSamples, ...args)),
  createSamples: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.CreateSamples, ...args)),
  deleteSamples: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.DeleteSamples, ...args)),

  getAnnotationsForSample: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.GetAnnotationsForSample, ...args)),
  createAnnotations: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.CreateAnnotations, ...args)),
  updateAnnotations: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.UpdateAnnotations, ...args)),
  deleteAnnotations: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.DeleteAnnotations, ...args)),

  getAnnotators: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.GetAnnotators, ...args)),
  createAnnotator: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.CreateAnnotator, ...args)),
  deleteAnnotators: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.DeleteAnnotators, ...args)),

  replacePoints: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(LocalStoreKeys.ReplacePoints, ...args))
}

const systemApi: ISystem = {
  createTemporaryDirectory: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(SystemKeys.CreateTemporaryDirectory, ...args)),
  deleteFile: (...args) => checkBoundryResult(ipcRenderer.invoke(SystemKeys.DeleteFile, ...args)),
  deleteDirectory: (...args) =>
    checkBoundryResult(ipcRenderer.invoke(SystemKeys.DeleteDirectory, ...args))
}

const zipApi: IZip = {
  extractTo: (...args) => checkBoundryResult(ipcRenderer.invoke(ZipKeys.ExtractTo, ...args))
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('localStore', localStoreApi)
    contextBridge.exposeInMainWorld('system', systemApi)
    contextBridge.exposeInMainWorld('zip', zipApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.localStore = localStoreApi
  // @ts-ignore (define in dts)
  window.system = systemApi
  // @ts-ignore (define in dts)
  window.zip = zipApi
}
