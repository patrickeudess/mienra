/**
 * Stub minimal du module « electron » pour le serveur de test (dev/).
 * Il enregistre les handlers IPC dans une simple Map au lieu du bus
 * Electron ; les API systèmes (ouverture de fichier, boîte de dialogue,
 * redémarrage) deviennent des traces console inoffensives.
 *
 * Ce fichier n'est JAMAIS embarqué dans l'application : il n'est résolu
 * qu'à travers dev/tsconfig.json (alias "electron" → ce stub).
 */
type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()

export const ipcMain = {
  handle(channel: string, fn: Handler): void {
    handlers.set(channel, fn)
  }
}

/** Accès aux handlers enregistrés (utilisé par le serveur de test). */
export function getHandlers(): Map<string, Handler> {
  return handlers
}

export const app = {
  isPackaged: false,
  getPath: (_nom: string): string => process.cwd(),
  relaunch: (): void => {
    console.log('[stub electron] app.relaunch() — ignoré en mode test')
  },
  exit: (_code?: number): void => {
    console.log('[stub electron] app.exit() — ignoré en mode test')
  }
}

export const shell = {
  openPath: async (chemin: string): Promise<string> => {
    console.log(`[stub electron] shell.openPath : ${chemin}`)
    return '' // '' = succès pour Electron
  }
}

export const dialog = {
  showSaveDialog: async (): Promise<{ canceled: boolean; filePath?: string }> => {
    console.log('[stub electron] dialog.showSaveDialog — annulé en mode test')
    return { canceled: true }
  }
}
