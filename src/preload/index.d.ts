import { ElectronAPI } from '@electron-toolkit/preload'
import {
  IAppDataStore,
  IDataStore,
  IExportApi,
  IFileUtils,
  IStoreManager,
  ISystem,
  IZip
} from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    store: IDataStore
    storeManager: IStoreManager
    appStore: IAppDataStore
    system: ISystem
    zip: IZip
    exportApi: IExportApi
    fileUtils: IFileUtils
  }
}
