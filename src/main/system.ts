import { ipcMain } from 'electron'
import { SystemKeys } from '../shared/ipcKeys'
import { wrap } from './utils'
import { ISystem } from '../shared/types'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const create: ISystem['createTemporaryDirectory'] = async () => {
  return fs.mkdtemp(path.join(os.tmpdir(), `cv-label-`))
}

const deleteFile: ISystem['deleteFile'] = async (filePath) => {
  return fs.rm(filePath, { recursive: true, force: true })
}

const deleteDirectory: ISystem['deleteDirectory'] = async (filePath) => {
  return fs.rm(filePath, { recursive: true, force: true })
}

ipcMain.handle(SystemKeys.CreateTemporaryDirectory, wrap(create))
ipcMain.handle(SystemKeys.DeleteFile, wrap(deleteFile))
ipcMain.handle(SystemKeys.DeleteDirectory, wrap(deleteDirectory))
