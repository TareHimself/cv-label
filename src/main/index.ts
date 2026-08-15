import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getAppPath } from './utils'

// Ties Electron's own userData dir (session storage, GPU cache, and - most importantly -
// the lock file requestSingleInstanceLock() below uses) to the same working directory
// getAppPath() already scopes the sqlite database/images to, but only once packaged or
// under an explicit override - plain `pnpm dev` keeps Electron's own default userData
// location rather than dumping Chromium's session/cache/blob-storage files in the repo
// root just for running from source. Must run before requestSingleInstanceLock() -
// Electron reads userData to place its lock file at that point.
//
// This makes the single-instance lock per-working-directory rather than global: two
// packaged instances pointed at the same working directory can't run concurrently
// (they'd corrupt the same sqlite database), but separate copies of the app in different
// folders - e.g. a portable install run from two locations - are treated as independent
// instances and can run side by side. e2e runs always set CV_LABEL_APP_PATH to their own
// isolated temp dir per run, so they get the same per-working-directory isolation too,
// unaffected by whichever way the packaged/dev branch goes.
if (app.isPackaged || process.env.CV_LABEL_APP_PATH) {
  app.setPath('userData', join(getAppPath(), 'userData'))
}

function createWindow(): void {
  // Create the browser window.
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Only one instance of the app should run against a given userData dir at a time -
// two instances writing to the same sqlite database concurrently can corrupt it,
// and they'd also fight over the same GPU cache dir and renderer dev-server port.
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

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('tarehimself.cv-label')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      //optimizer.watchWindowShortcuts(window)
      if (is.dev && !process.env.CV_LABEL_APP_PATH) {
        window.webContents.openDevTools()
      }
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Ipc based modules
import './store'
import './appStore'
import './zip'
import './system'
import './scratchProtocol'
