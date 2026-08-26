import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getAppPath } from './utils'

// Ties Electron's own userData dir (and its single-instance lock file) to the same working
// directory getAppPath() scopes the database/images to - makes the instance lock
// per-working-directory rather than global. Only once packaged or under an explicit
// override, so plain `pnpm dev` keeps Electron's default userData location. Must run
// before requestSingleInstanceLock() below, which reads userData to place its lock file.
if (app.isPackaged || process.env.CV_LABEL_APP_PATH) {
  app.setPath('userData', join(getAppPath(), 'userData'))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev server URL for HMR, local file otherwise.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Two instances writing to the same sqlite database concurrently would corrupt it.
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existingWindow] = BrowserWindow.getAllWindows()
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore()
      existingWindow.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('tarehimself.cv-label')

    app.on('browser-window-created', (_, window) => {
      if (is.dev && !process.env.CV_LABEL_APP_PATH) {
        window.webContents.openDevTools()
      }
    })

    ipcMain.on('ping', () => console.log('pong'))

    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

import './store'
import './appStore'
import './zip'
import './system'
import './scratchProtocol'
