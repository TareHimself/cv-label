import { app } from 'electron'
import path from 'node:path'

export const getAppPath = () =>
  process.env.CV_LABEL_APP_PATH ??
  (app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath())
