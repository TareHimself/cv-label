import { app } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const getAppPath = () =>
  process.env.CV_LABEL_APP_PATH ??
  (app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath())

// electron-vite bundles this flat into out/main/ regardless of chunk - not app.getAppPath(), which in dev mode resolves to out/main itself, not the repo root.
const mainDir = path.dirname(fileURLToPath(import.meta.url))

export const getMigrationsPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'drizzle')
    : path.join(mainDir, '..', '..', 'drizzle')

export const getAppMigrationsPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'drizzle-app')
    : path.join(mainDir, '..', '..', 'drizzle-app')
