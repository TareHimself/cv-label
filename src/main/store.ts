import { net, protocol, app } from 'electron'
import { IPCKeys } from '../shared/types'
import url from 'node:url'
// import path from 'path'
import { importWorkerModule } from './worker'
import { getAppPath, getMigrationsPath } from './utils'
import databaseWorkerPath from './database?modulePath'
import { handleIpc } from './ipc'
const database = await importWorkerModule<typeof import('./database')>(
  url.pathToFileURL(databaseWorkerPath),
  {
    APP_PATH: getAppPath(),
    MIGRATIONS_PATH: getMigrationsPath()
  }
)

protocol.registerSchemesAsPrivileged([
  {
    scheme: database.IMAGES_PROTOCOL_URL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

app.whenReady().then(() => {
  protocol.handle(database.IMAGES_PROTOCOL_URL, async (req) => {
    try {
      const filePath = await database.getImagePathFromUrl(req.url)
      if (filePath === undefined) {
        return new Response(undefined, {
          status: 404
        })
      }

      return net.fetch(url.pathToFileURL(filePath).toString())
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', {
        status: 500
      })
    }
  })
})

// const foo = database.connect)
handleIpc(IPCKeys.LocalStore_Connect, database.connect)
handleIpc(IPCKeys.LocalStore_Disconnect, database.disconnect)

handleIpc(IPCKeys.LocalStore_GetProjects, database.getProjects)
handleIpc(IPCKeys.LocalStore_CreateProject, database.createProject)
handleIpc(IPCKeys.LocalStore_UpdateProjects, database.updateProjects)
handleIpc(IPCKeys.LocalStore_DeleteProjects, database.deleteProjects)

handleIpc(IPCKeys.LocalStore_GetTasks, database.getTasks)
handleIpc(IPCKeys.LocalStore_CreateTask, database.createTask)
handleIpc(IPCKeys.LocalStore_UpdateTasks, database.updateTasks)
handleIpc(IPCKeys.LocalStore_DeleteTasks, database.deleteTasks)

handleIpc(IPCKeys.LocalStore_GetSamplesForTask, database.getSamplesForTask)
handleIpc(IPCKeys.LocalStore_GetSamples, database.getSamples)
handleIpc(IPCKeys.LocalStore_CreateSamples, database.createSamples)
handleIpc(IPCKeys.LocalStore_UpdateSamples, database.updateSamples)
handleIpc(IPCKeys.LocalStore_DeleteSamples, database.deleteSamples)

handleIpc(IPCKeys.LocalStore_GetAnnotationsForSample, database.getAnnotationsForSample)
handleIpc(IPCKeys.LocalStore_CreateAnnotations, database.createAnnotations)
handleIpc(IPCKeys.LocalStore_UpdateAnnotations, database.updateAnnotations)
handleIpc(IPCKeys.LocalStore_DeleteAnnotations, database.deleteAnnotations)

handleIpc(IPCKeys.LocalStore_GetAnnotators, database.getAnnotators)
handleIpc(IPCKeys.LocalStore_CreateAnnotator, database.createAnnotator)
handleIpc(IPCKeys.LocalStore_DeleteAnnotators, database.deleteAnnotators)

handleIpc(IPCKeys.LocalStore_ReplacePoints, database.replacePoints)
