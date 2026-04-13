import { ipcMain, net, protocol, app } from 'electron'
import { LocalStoreKeys } from '../shared/ipcKeys'
import url from 'node:url'
// import path from 'path'
import { importWorkerModule } from './worker'
import { getAppPath } from './utils'
import databaseWorkerPath from './database?modulePath'
import { wrap } from './utils'
const database = await importWorkerModule<typeof import('./database')>(
  url.pathToFileURL(databaseWorkerPath),
  {
    APP_PATH: getAppPath()
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

// const foo = wrap(database.connect)
ipcMain.handle(LocalStoreKeys.Connect, wrap(database.connect))
ipcMain.handle(LocalStoreKeys.Disconnect, wrap(database.disconnect))

ipcMain.handle(LocalStoreKeys.GetProjects, wrap(database.getProjects))
ipcMain.handle(LocalStoreKeys.CreateProject, wrap(database.createProject))
ipcMain.handle(LocalStoreKeys.DeleteProjects, wrap(database.deleteProjects))

ipcMain.handle(LocalStoreKeys.GetTasks, wrap(database.getTasks))
ipcMain.handle(LocalStoreKeys.CreateTask, wrap(database.createTask))
ipcMain.handle(LocalStoreKeys.DeleteTasks, wrap(database.deleteTasks))

ipcMain.handle(LocalStoreKeys.GetSamplesForTask, wrap(database.getSamplesForTask))
ipcMain.handle(LocalStoreKeys.GetSamples, wrap(database.getSamples))
ipcMain.handle(LocalStoreKeys.CreateSamples, wrap(database.createSamples))
ipcMain.handle(LocalStoreKeys.DeleteSamples, wrap(database.deleteSamples))

ipcMain.handle(LocalStoreKeys.GetAnnotationsForSample, wrap(database.getAnnotationsForSample))
ipcMain.handle(LocalStoreKeys.CreateAnnotations, wrap(database.createAnnotations))
ipcMain.handle(LocalStoreKeys.UpdateAnnotations, wrap(database.updateAnnotations))
ipcMain.handle(LocalStoreKeys.DeleteAnnotations, wrap(database.deleteAnnotations))

ipcMain.handle(LocalStoreKeys.GetAnnotators, wrap(database.getAnnotators))
ipcMain.handle(LocalStoreKeys.CreateAnnotator, wrap(database.createAnnotator))
ipcMain.handle(LocalStoreKeys.DeleteAnnotators, wrap(database.deleteAnnotators))

ipcMain.handle(LocalStoreKeys.ReplacePoints, wrap(database.replacePoints))
