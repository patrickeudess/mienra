/**
 * Processus principal Electron de MIENRA.
 * - Crée la fenêtre de l'application.
 * - Enregistre les handlers IPC de chaque module.
 * - Déclenche la sauvegarde automatique de la base à la fermeture.
 */
import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc'
import { createBackup } from './database/backup'
import { disconnectPrisma } from './database/client'

function createWindow(): void {
  const fenetre = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'MIENRA — Gestion scolaire',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // Sécurité : le renderer n'a aucun accès Node direct,
      // tout passe par le pont contextBridge du preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  fenetre.on('ready-to-show', () => fenetre.show())

  // Les liens externes s'ouvrent dans le navigateur, pas dans l'application.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // En dev, electron-vite sert le renderer ; en production on charge le build.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    fenetre.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    fenetre.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

// Sauvegarde automatique : copie horodatée de la base à chaque fermeture,
// avec conservation des dix dernières sauvegardes.
app.on('before-quit', async (event) => {
  event.preventDefault()
  try {
    await disconnectPrisma() // ferme la connexion avant de copier le fichier
    createBackup()
  } finally {
    app.exit(0)
  }
})
