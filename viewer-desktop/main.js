const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

function docsRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs')
    : path.resolve(__dirname, '..', 'docs')
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    const relativePath = url.pathname.replace(/^\/+/, '')
    const filePath = path.join(docsRoot(), relativePath)
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    title: 'ReceiptOS Viewer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.webContents.on('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`
        Promise.all([
          fetch('../receipt-examples/index.json').then((r) => r.json()),
          Promise.resolve(document.body.textContent.includes('Load local artifacts')),
        ]).then(([manifest, hasLocal]) => ({
          title: document.title,
          exampleCount: manifest.examples.length,
          exampleIds: manifest.examples.map((e) => e.id),
          hasLocalArtifactsUI: hasLocal,
        }))
      `)
      console.log('[receiptos-viewer] did-finish-load', JSON.stringify(result))
    } catch (error) {
      console.error('[receiptos-viewer] load-check-failed', error)
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  await win.loadURL('app://viewer/artifact-viewer/index.html')
}

app.whenReady().then(async () => {
  registerAppProtocol()
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
