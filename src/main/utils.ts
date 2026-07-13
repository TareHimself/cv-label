import { app } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const getAppPath = () =>
  process.env.CV_LABEL_APP_PATH ??
  (app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath())

// electron-vite bundles every src/main/** module flat into out/main/, regardless of which
// chunk this code ends up in - so this file's own bundled location is always out/main,
// two levels below the repo root. Deliberately not app.getAppPath(): in dev mode (launched
// via out/main/index.js, as both `electron-vite dev` and the e2e/manual-test harness do) it
// resolves to out/main itself, not the repo root, which pointed this at a non-existent
// out/main/drizzle folder.
const mainDir = path.dirname(fileURLToPath(import.meta.url))

export const getMigrationsPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'drizzle')
    : path.join(mainDir, '..', '..', 'drizzle')
