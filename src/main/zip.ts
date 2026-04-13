import { ipcMain } from 'electron'
import { ZipKeys } from '../shared/ipcKeys'
import { wrap } from './utils'
import { IZip } from '../shared/types'
import AdmZip from 'adm-zip'
import path from 'path'



const extractTo: IZip['extractTo'] = async (filePath,destination) => {
    const zip = new AdmZip(path.normalize(filePath))
    await new Promise((res,rej) => {
        zip.extractAllToAsync(destination,true,false,(e) => {
            if(e !== undefined){
                rej(e)
            }
            else
            {
                res(true)
            }
        })
    })
}


ipcMain.handle(ZipKeys.ExtractTo, wrap(extractTo))
