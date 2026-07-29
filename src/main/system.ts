import { IPCKeys } from '../shared/types'
import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
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

handleIpc(IPCKeys.System_WriteFile, async (filePath, data) => {
  await fs.writeFile(filePath, Buffer.from(data))
})

handleIpc(IPCKeys.System_ReadTextFile, async (filePath) => {
  return fs.readFile(filePath, 'utf-8')
})

const listFilesRecursive = async (dirPath: string, base: string = dirPath): Promise<string[]> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(fullPath, base)))
    } else if (entry.isFile()) {
      results.push(path.relative(base, fullPath).replace(/\\/g, '/'))
    }
  }

  return results
}

handleIpc(IPCKeys.System_ListFilesRecursive, async (dirPath) => {
  return listFilesRecursive(dirPath)
})

handleIpc(IPCKeys.System_GetFileSize, async (filePath) => {
  return (await fs.stat(filePath)).size
})

handleIpc(IPCKeys.System_GetImageDimensions, async (filePath) => {
  const metadata = await sharp(filePath).metadata()
  return { width: metadata.width ?? 0, height: metadata.height ?? 0 }
})
