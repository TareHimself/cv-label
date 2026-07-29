import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IDataStore,
  IStoreManager,
  ISystem,
  IPCKeys,
  IZip,
  IExportApi,
  IFileUtils,
  ExportProgressEvent
} from '../shared/types'
import { checkBoundaryResult } from '../shared/utils'
const wrap =
  <T, TArgs extends unknown[]>(key: IPCKeys) =>
  (...args: TArgs) =>
    checkBoundaryResult<T>(ipcRenderer.invoke(key, ...args))
// Custom APIs for renderer
const storeApi: IDataStore = {
  connect: wrap(IPCKeys.Store_Connect),
  disconnect: wrap(IPCKeys.Store_Disconnect),

  getProjects: wrap(IPCKeys.Store_GetProjects),
  createProject: wrap(IPCKeys.Store_CreateProject),
  updateProjects: wrap(IPCKeys.Store_UpdateProjects),
  deleteProjects: wrap(IPCKeys.Store_DeleteProjects),

  getTasksForProject: wrap(IPCKeys.Store_GetTasks),
  createTask: wrap(IPCKeys.Store_CreateTask),
  updateTasks: wrap(IPCKeys.Store_UpdateTasks),
  deleteTasks: wrap(IPCKeys.Store_DeleteTasks),

  getSamplesForTask: wrap(IPCKeys.Store_GetSamplesForTask),
  getSamples: wrap(IPCKeys.Store_GetSamples),
  createSamples: wrap(IPCKeys.Store_CreateSamples),
  updateSamples: wrap(IPCKeys.Store_UpdateSamples),
  deleteSamples: wrap(IPCKeys.Store_DeleteSamples),

  getAnnotationsForSample: wrap(IPCKeys.Store_GetAnnotationsForSample),
  createAnnotations: wrap(IPCKeys.Store_CreateAnnotations),
  updateAnnotations: wrap(IPCKeys.Store_UpdateAnnotations),
  deleteAnnotations: wrap(IPCKeys.Store_DeleteAnnotations),

  getAnnotators: wrap(IPCKeys.Store_GetAnnotators),
  createAnnotator: wrap(IPCKeys.Store_CreateAnnotator),
  deleteAnnotators: wrap(IPCKeys.Store_DeleteAnnotators),

  replacePoints: wrap(IPCKeys.Store_ReplacePoints)
}

const storeManagerApi: IStoreManager = {
  listStores: wrap(IPCKeys.Store_List),
  useStore: wrap(IPCKeys.Store_UseStore)
}

const systemApi: ISystem = {
  createTemporaryDirectory: wrap(IPCKeys.System_CreateTemporaryDirectory),
  deleteFile: wrap(IPCKeys.System_DeleteFile),
  deleteDirectory: wrap(IPCKeys.System_DeleteDirectory),
  saveFile: wrap(IPCKeys.System_SaveFile),
  writeFile: wrap(IPCKeys.System_WriteFile),
  readTextFile: wrap(IPCKeys.System_ReadTextFile),
  listFilesRecursive: wrap(IPCKeys.System_ListFilesRecursive),
  getFileSize: wrap(IPCKeys.System_GetFileSize),
  getImageDimensions: wrap(IPCKeys.System_GetImageDimensions),
  getScratchPreviewUri: wrap(IPCKeys.System_GetScratchPreviewUri)
}

const zipApi: IZip = {
  extractTo: wrap(IPCKeys.Zip_ExtractTo)
}

// Synchronous and preload-only, unlike everything else here - never crosses IPC, so it
// doesn't go through wrap()/ipcRenderer.invoke.
const fileUtilsApi: IFileUtils = {
  getPathForFile: (file) => webUtils.getPathForFile(file)
}

const exportApi: IExportApi = {
  runExport: wrap(IPCKeys.Export_Run),
  onProgress: (callback) => {
    const listener = (_: unknown, event: ExportProgressEvent) => callback(event)
    ipcRenderer.on(IPCKeys.Export_Progress, listener)
    return () => ipcRenderer.removeListener(IPCKeys.Export_Progress, listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('store', storeApi)
    contextBridge.exposeInMainWorld('storeManager', storeManagerApi)
    contextBridge.exposeInMainWorld('system', systemApi)
    contextBridge.exposeInMainWorld('zip', zipApi)
    contextBridge.exposeInMainWorld('exportApi', exportApi)
    contextBridge.exposeInMainWorld('fileUtils', fileUtilsApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.store = storeApi
  // @ts-ignore (define in dts)
  window.storeManager = storeManagerApi
  // @ts-ignore (define in dts)
  window.system = systemApi
  // @ts-ignore (define in dts)
  window.zip = zipApi
  // @ts-ignore (define in dts)
  window.exportApi = exportApi
  // @ts-ignore (define in dts)
  window.fileUtils = fileUtilsApi
}
