import { ElectronAPI } from '@electron-toolkit/preload'
import { IDataStore, IExportApi, IFileUtils, IStoreManager, ISystem, IZip } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    store: IDataStore
    storeManager: IStoreManager
    system: ISystem
    zip: IZip
    exportApi: IExportApi
    fileUtils: IFileUtils
  }
}
