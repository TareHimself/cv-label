import url from 'node:url'
import { importWorkerModule } from './worker'
import { getAppPath, getAppMigrationsPath } from './utils'
import appDatabaseWorkerPath from './appDatabase?modulePath'
import { IAnnotator, IAnnotatorUpdate, IAppDataStore, IPCKeys } from '../shared/types'
import { handleIpc } from './ipc'

/** The always-on, store-agnostic counterpart to LocalStore - annotators live in their own
 *  database, independent of whichever IDataStore is currently active (see
 *  storeOrchestrator.ts), so this is instantiated once and never registered with it.
 *  Lazily spawns its worker on first real use, same as LocalStore.ensureWorker(). */
export class AppStore implements IAppDataStore {
  #workerPromise?: Promise<typeof import('./appDatabase') & { terminate(): Promise<number> }>

  private ensureWorker() {
    this.#workerPromise ??= importWorkerModule<typeof import('./appDatabase')>(
      url.pathToFileURL(appDatabaseWorkerPath),
      { APP_PATH: getAppPath(), MIGRATIONS_PATH: getAppMigrationsPath() }
    )
    return this.#workerPromise
  }

  getAnnotators = async (): Promise<IAnnotator[]> => (await this.ensureWorker()).getAnnotators()

  createAnnotator = async (
    id: string,
    name: string,
    annotatorUrl: string,
    headers: Record<string, string>
  ): Promise<IAnnotator> =>
    (await this.ensureWorker()).createAnnotator(id, name, annotatorUrl, headers)

  updateAnnotators = async (updates: IAnnotatorUpdate[]): Promise<IAnnotator[]> =>
    (await this.ensureWorker()).updateAnnotators(updates)

  deleteAnnotators = async (annotatorIds: string[]): Promise<boolean[]> =>
    (await this.ensureWorker()).deleteAnnotators(annotatorIds)
}

const appStore = new AppStore()

handleIpc(IPCKeys.App_GetAnnotators, (...args) => appStore.getAnnotators(...args))
handleIpc(IPCKeys.App_CreateAnnotator, (...args) => appStore.createAnnotator(...args))
handleIpc(IPCKeys.App_UpdateAnnotators, (...args) => appStore.updateAnnotators(...args))
handleIpc(IPCKeys.App_DeleteAnnotators, (...args) => appStore.deleteAnnotators(...args))
