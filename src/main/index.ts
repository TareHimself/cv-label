import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// e2e runs get their own isolated userData dir so their single-instance lock
// doesn't collide with a real dev/production instance sharing the default one.
if (process.env.CV_LABEL_APP_PATH) {
  app.setPath('userData', join(process.env.CV_LABEL_APP_PATH, 'userData'))
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
import './zip'
import './system'
