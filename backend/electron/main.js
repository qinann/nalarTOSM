const path = require('path');
const { app, BrowserWindow, Menu, shell, dialog, session, globalShortcut } = require('electron');
const { startServer } = require('../server');

// Force ANGLE to use OpenGL backend instead of D3D11 to fix Unity URP shader compilation
app.commandLine.appendSwitch('use-angle', 'gl');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

let mainWindow;
let backendServer;

function getUserDataDir() {
  return process.env.TOSM_USER_DATA_DIR
    || (!app.isPackaged ? path.resolve(__dirname, '../.desktop-data') : app.getPath('userData'));
}

app.setPath('userData', getUserDataDir());

function getFrontendDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'frontend')
    : path.resolve(__dirname, '../../frontend');
}

function getWebglModul3Dir() {
  return path.join(getFrontendDir(), 'assets', 'animations', 'Modul3');
}

function getDatabasePath() {
  return path.join(app.getPath('userData'), 'tosm.db');
}

async function findFreePort() {
  const { createServer } = require('net');

  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function bootBackend() {
  const port = await findFreePort();

  backendServer = await startServer({
    host: '127.0.0.1',
    port,
    frontendDir: getFrontendDir(),
    databasePath: getDatabasePath(),
    webglModul3Dir: getWebglModul3Dir(),
    silent: true,
  });

  return `http://127.0.0.1:${port}`;
}

async function createMainWindow() {
  const baseUrl = await bootBackend();

  Menu.setApplicationMenu(null);

  // Allow Unity WebGL: needs wasm-unsafe-eval, blob: workers, and unsafe-inline
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' blob: data:; " +
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://unpkg.com; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' blob:; " +
          "worker-src blob: 'self'; " +
          "img-src 'self' data: blob:; " +
          "font-src 'self' data:;"
        ],
      },
    });
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#03071a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  await mainWindow.loadURL(baseUrl);
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    console.error('Gagal memulai aplikasi desktop:', error);
    dialog.showErrorBox(
      'TOSM Gagal Dibuka',
      `${error?.message || error}\n\nPeriksa file aplikasi dan coba lagi.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});

app.on('before-quit', () => {
  backendServer?.server?.close();
  backendServer?.db?.close();
});
