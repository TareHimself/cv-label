import { dialog, BrowserWindow } from 'electron'
import { IPCKeys } from '../shared/types'
import { handleIpc } from './ipc'
import { StoreOrchestrator } from './storeOrchestrator'

export const registerExportHandlers = (orchestrator: StoreOrchestrator): void => {
  handleIpc(IPCKeys.Export_Run, async (suggestedName, manifest) => {
    const window = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = window
      ? await dialog.showSaveDialog(window, { defaultPath: suggestedName })
      : await dialog.showSaveDialog({ defaultPath: suggestedName })

    if (canceled || !filePath) {
      return false
    }

    await orchestrator.current.exportSamplesToArchive(
      filePath,
      manifest,
      undefined,
      (completed, total) => {
        window?.webContents.send(IPCKeys.Export_Progress, { completed, total })
      }
    )

    return true
  })
}
