import { ArchiveManifest, IDataStore, StoreDescriptor } from '../shared/types'

/** What main-only code (the export handler, the image protocol) needs beyond the
 *  renderer-visible IDataStore contract - kept out of the shared IDataStore interface
 *  since a renderer-side type has no business knowing about either concern. */
export interface IMainDataStore extends IDataStore {
  exportSamplesToArchive(
    destinationPath: string,
    manifest: ArchiveManifest,
    concurrency?: number,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void>
}

interface RegisteredStore {
  descriptor: StoreDescriptor
  store: IMainDataStore
  resolveImage: (imageId: string) => Promise<Response>
}

/** Owns every registered IDataStore and which one is "current" - the Store_* IPC handlers
 *  and the image:// protocol handler in main/store.ts both dispatch through this instead
 *  of a captured, hardcoded store reference. Re-reading `current` on every call means
 *  switching stores takes effect immediately for whatever's called next. */
export class StoreOrchestrator {
  #stores = new Map<string, RegisteredStore>()
  #currentId?: string

  register(entry: RegisteredStore): void {
    this.#stores.set(entry.descriptor.id, entry)
    this.#currentId ??= entry.descriptor.id
  }

  list = async (): Promise<StoreDescriptor[]> =>
    [...this.#stores.values()].map((entry) => entry.descriptor)

  useStore = async (id: string): Promise<void> => {
    const entry = this.#stores.get(id)
    if (!entry) throw new Error(`Unknown store: ${id}`)

    const previousId = this.#currentId
    await entry.store.connect()
    this.#currentId = id

    // Free the store being switched away from - meaningful now that disconnect() does
    // real teardown instead of being a no-op.
    if (previousId !== undefined && previousId !== id) {
      await this.#stores.get(previousId)?.store.disconnect()
    }
  }

  get current(): IMainDataStore {
    if (this.#currentId === undefined) {
      throw new Error('No store is currently active')
    }
    const entry = this.#stores.get(this.#currentId)
    if (!entry) {
      throw new Error('Current store is no longer registered')
    }
    return entry.store
  }

  resolveImage = async (storeId: string, imageId: string): Promise<Response> => {
    const entry = this.#stores.get(storeId)
    if (!entry) {
      return new Response(undefined, { status: 404 })
    }
    return entry.resolveImage(imageId)
  }
}
