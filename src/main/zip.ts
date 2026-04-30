import { IPCKeys } from '../shared/types'
import AdmZip from 'adm-zip'
import path from 'path'
import { handleIpc } from './ipc'

handleIpc(IPCKeys.Zip_ExtractTo, async (filePath, destination) => {
  const zip = new AdmZip(path.normalize(filePath))
  await new Promise((res, rej) => {
    zip.extractAllToAsync(destination, true, false, (e) => {
      if (e !== undefined) {
        rej(e)
      } else {
        res(true)
      }
    })
  })
})
