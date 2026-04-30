import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IDataStore, ISystem, IPCKeys, IZip } from '../shared/types'
import { checkBoundryResult } from '../shared/utils'
const wrap =
  <T, TArgs extends unknown[]>(key: IPCKeys) =>
  (...args: TArgs) =>
    checkBoundryResult<T>(ipcRenderer.invoke(key, ...args))
// Custom APIs for renderer
const localStoreApi: IDataStore = {
  connect: wrap(IPCKeys.LocalStore_Connect),
  disconnect: wrap(IPCKeys.LocalStore_Disconnect),

  getProjects: wrap(IPCKeys.LocalStore_GetProjects),
  createProject: wrap(IPCKeys.LocalStore_CreateProject),
  deleteProjects: wrap(IPCKeys.LocalStore_DeleteProjects),

  getTasksForProject: wrap(IPCKeys.LocalStore_GetTasks),
  createTask: wrap(IPCKeys.LocalStore_CreateTask),
  deleteTasks: wrap(IPCKeys.LocalStore_DeleteTasks),

  getSamplesForTask: wrap(IPCKeys.LocalStore_GetSamplesForTask),
  getSamples: wrap(IPCKeys.LocalStore_GetSamples),
  createSamples: wrap(IPCKeys.LocalStore_CreateSamples),
  updateSamples: wrap(IPCKeys.LocalStore_UpdateSamples),
  deleteSamples: wrap(IPCKeys.LocalStore_DeleteSamples),

  getAnnotationsForSample: wrap(IPCKeys.LocalStore_GetAnnotationsForSample),
  createAnnotations: wrap(IPCKeys.LocalStore_CreateAnnotations),
  updateAnnotations: wrap(IPCKeys.LocalStore_UpdateAnnotations),
  deleteAnnotations: wrap(IPCKeys.LocalStore_DeleteAnnotations),

  getAnnotators: wrap(IPCKeys.LocalStore_GetAnnotators),
  createAnnotator: wrap(IPCKeys.LocalStore_CreateAnnotator),
  deleteAnnotators: wrap(IPCKeys.LocalStore_DeleteAnnotators),

  replacePoints: wrap(IPCKeys.LocalStore_ReplacePoints)
}

const systemApi: ISystem = {
  createTemporaryDirectory: wrap(IPCKeys.System_CreateTemporaryDirectory),
  deleteFile: wrap(IPCKeys.System_DeleteFile),
  deleteDirectory: wrap(IPCKeys.System_DeleteDirectory)
}

const zipApi: IZip = {
  extractTo: wrap(IPCKeys.Zip_ExtractTo)
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
