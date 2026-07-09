import { ElectronAPI } from '@electron-toolkit/preload'
import { IDataStore, ISystem, IZip } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    localStore: IDataStore
    system: ISystem
    zip: IZip
  }
}
