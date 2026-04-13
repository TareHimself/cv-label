import { ElectronAPI } from '@electron-toolkit/preload'
import { IDataStore, ISystem, IZip } from 'src/shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    localStore: IDataStore
    temp: ISystem
    zip: IZip
  }
}
