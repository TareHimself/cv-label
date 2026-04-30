import { IPCKeys } from '../shared/types'
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
