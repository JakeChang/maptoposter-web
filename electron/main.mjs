import { app, BrowserWindow, shell, Menu, dialog } from 'electron'
import { createServer, Socket } from 'net'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow = null
let serverPort = 0

/**
 * Find an available port by briefly listening on port 0.
 */
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        srv.close(() => reject(new Error('Could not determine port')))
      }
    })
    srv.on('error', reject)
  })
}

/**
 * Resolve the path to the Nuxt server entry point.
 */
function getServerEntry() {
  if (app.isPackaged) {
    return join(process.resourcesPath, '.output', 'server', 'index.mjs')
  }
  return join(__dirname, '..', '.output', 'server', 'index.mjs')
}

/**
 * Start the Nitro server by dynamically importing it.
 * Set env vars before import so the server binds to the right port.
 */
async function startServer() {
  serverPort = await getAvailablePort()

  process.env.PORT = String(serverPort)
  process.env.HOST = '127.0.0.1'
  process.env.NODE_ENV = 'production'
  process.env.NITRO_PORT = String(serverPort)
  process.env.NITRO_HOST = '127.0.0.1'

  const serverEntry = getServerEntry()
  await import(pathToFileURL(serverEntry).href)

  // Wait until the server is accepting connections
  await waitForServer(serverPort)
}

/**
 * Poll until the server is accepting connections.
 */
function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      attempts++
      const socket = new Socket()
      socket.connect(port, '127.0.0.1', () => {
        socket.destroy()
        resolve()
      })
      socket.on('error', () => {
        socket.destroy()
        if (attempts >= maxAttempts) {
          reject(new Error('Server failed to start within timeout'))
        } else {
          setTimeout(check, 500)
        }
      })
    }
    check()
  })
}

/**
 * Create the main application window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Map Poster',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.mjs'),
    },
    backgroundColor: '#0f0f0f',
    show: false,
  })

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Build custom application menu.
 */
function buildAppMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        {
          label: '關於 Map Poster',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '關於 Map Poster',
              message: 'Map Poster',
              detail: `版本：${app.getVersion()}\n打造精美極簡地圖海報\n\n© 2026 Map Poster`,
            })
          },
        },
        { type: 'separator' },
        { label: '隱藏 Map Poster', role: 'hide' },
        { label: '隱藏其他', role: 'hideOthers' },
        { label: '全部顯示', role: 'unhide' },
        { type: 'separator' },
        { label: '結束 Map Poster', role: 'quit' },
      ],
    },
    {
      label: '編輯',
      submenu: [
        { label: '復原', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪下', role: 'cut' },
        { label: '拷貝', role: 'copy' },
        { label: '貼上', role: 'paste' },
        { label: '全選', role: 'selectAll' },
      ],
    },
    {
      label: '顯示',
      submenu: [
        { label: '重新載入', role: 'reload' },
        { label: '強制重新載入', role: 'forceReload' },
        { type: 'separator' },
        { label: '實際大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '縮小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全螢幕', role: 'togglefullscreen' },
      ],
    },
    {
      label: '視窗',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '縮放', role: 'zoom' },
        { type: 'separator' },
        { label: '將所有視窗移到最前', role: 'front' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App lifecycle
app.on('ready', async () => {
  try {
    buildAppMenu()
    await startServer()
    createWindow()
  } catch (err) {
    console.error('Failed to start application:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
