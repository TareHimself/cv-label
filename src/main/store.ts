import { protocol, app } from 'electron'
import { IMAGE_PROTOCOL_URL, IPCKeys, LOCAL_STORE_ID, SCRATCH_PROTOCOL_URL } from '../shared/types'
import { handleIpc } from './ipc'
import { registerExportHandlers } from './exportArchive'
import { LocalStore } from './localStore'
import { StoreOrchestrator } from './storeOrchestrator'

const orchestrator = new StoreOrchestrator()
const localStore = new LocalStore()
orchestrator.register({
  descriptor: { id: LOCAL_STORE_ID, name: 'Local' },
  store: localStore,
  resolveImage: localStore.resolveImage
})

// protocol.registerSchemesAsPrivileged can only be called once per app lifetime - every
// custom scheme the app uses (image://, scratch://, ...) must be registered together in
// this single call, or the ones left out of it silently never become privileged even
// though registering them separately doesn't throw.
protocol.registerSchemesAsPrivileged([
  {
    scheme: IMAGE_PROTOCOL_URL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  },
  {
    scheme: SCRATCH_PROTOCOL_URL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

app.whenReady().then(() => {
  protocol.handle(IMAGE_PROTOCOL_URL, async (req) => {
    try {
      const url = new URL(req.url)
      // storeId is the host/authority segment (image://<storeId>/<imageId>.<ext>) - same
      // custom-scheme parsing behavior scratch:// relies on.
      return await orchestrator.resolveImage(url.host, url.pathname.slice(1))
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', {
        status: 500
      })
    }
  })
})

handleIpc(IPCKeys.Store_List, orchestrator.list)
handleIpc(IPCKeys.Store_UseStore, orchestrator.useStore)

handleIpc(IPCKeys.Store_Connect, (...args) => orchestrator.current.connect(...args))
handleIpc(IPCKeys.Store_Disconnect, (...args) => orchestrator.current.disconnect(...args))

handleIpc(IPCKeys.Store_GetProjects, (...args) => orchestrator.current.getProjects(...args))
handleIpc(IPCKeys.Store_CreateProject, (...args) => orchestrator.current.createProject(...args))
handleIpc(IPCKeys.Store_UpdateProjects, (...args) => orchestrator.current.updateProjects(...args))
handleIpc(IPCKeys.Store_DeleteProjects, (...args) => orchestrator.current.deleteProjects(...args))

handleIpc(IPCKeys.Store_GetTasks, (...args) => orchestrator.current.getTasksForProject(...args))
handleIpc(IPCKeys.Store_CreateTask, (...args) => orchestrator.current.createTask(...args))
handleIpc(IPCKeys.Store_UpdateTasks, (...args) => orchestrator.current.updateTasks(...args))
handleIpc(IPCKeys.Store_DeleteTasks, (...args) => orchestrator.current.deleteTasks(...args))

handleIpc(IPCKeys.Store_GetTagsForProject, (...args) =>
  orchestrator.current.getTagsForProject(...args)
)
handleIpc(IPCKeys.Store_CreateTag, (...args) => orchestrator.current.createTag(...args))
handleIpc(IPCKeys.Store_UpdateTags, (...args) => orchestrator.current.updateTags(...args))
handleIpc(IPCKeys.Store_DeleteTags, (...args) => orchestrator.current.deleteTags(...args))
handleIpc(IPCKeys.Store_AddTagsToTasks, (...args) => orchestrator.current.addTagsToTasks(...args))
handleIpc(IPCKeys.Store_RemoveTagsFromTasks, (...args) =>
  orchestrator.current.removeTagsFromTasks(...args)
)

handleIpc(IPCKeys.Store_GetSamplesForTask, (...args) =>
  orchestrator.current.getSamplesForTask(...args)
)
handleIpc(IPCKeys.Store_GetSamples, (...args) => orchestrator.current.getSamples(...args))
handleIpc(IPCKeys.Store_CreateSamples, (...args) => orchestrator.current.createSamples(...args))
handleIpc(IPCKeys.Store_UpdateSamples, (...args) => orchestrator.current.updateSamples(...args))
handleIpc(IPCKeys.Store_DeleteSamples, (...args) => orchestrator.current.deleteSamples(...args))

handleIpc(IPCKeys.Store_GetAnnotationsForSample, (...args) =>
  orchestrator.current.getAnnotationsForSample(...args)
)
handleIpc(IPCKeys.Store_CreateAnnotations, (...args) =>
  orchestrator.current.createAnnotations(...args)
)
handleIpc(IPCKeys.Store_UpdateAnnotations, (...args) =>
  orchestrator.current.updateAnnotations(...args)
)
handleIpc(IPCKeys.Store_DeleteAnnotations, (...args) =>
  orchestrator.current.deleteAnnotations(...args)
)

handleIpc(IPCKeys.Store_ReplacePoints, (...args) => orchestrator.current.replacePoints(...args))

registerExportHandlers(orchestrator)
