import { IpcDataStore } from '@renderer/data/IpcDataStore'
import { IDataStore } from '@shared/types'
import { create } from 'zustand'

type AppStoreState = {
  store: IDataStore
}

type AppStoreActions = object

export const useAppStore = create<AppStoreState & AppStoreActions>(() => {
  return {
    store: new IpcDataStore()
  }
})
