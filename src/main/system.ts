import { IPCKeys } from '../shared/types'
import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { handleIpc } from './ipc'

handleIpc(IPCKeys.System_CreateTemporaryDirectory, async () => {
  return fs.mkdtemp(path.join(os.tmpdir(), `cv-label-`))
})

handleIpc(IPCKeys.System_DeleteFile, async (filePath) => {
  return fs.rm(filePath, { recursive: true, force: true })
})

handleIpc(IPCKeys.System_DeleteDirectory, async (filePath) => {
  return fs.rm(filePath, { recursive: true, force: true })
})

handleIpc(IPCKeys.System_SaveFile, async (suggestedName, data) => {
  const window = BrowserWindow.getFocusedWindow()
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, { defaultPath: suggestedName })
    : await dialog.showSaveDialog({ defaultPath: suggestedName })

  if (canceled || !filePath) {
    return false
  }

  await fs.writeFile(filePath, Buffer.from(data))
  return true
})
