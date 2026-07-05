/**
 * Preload : pont sécurisé entre le processus principal et le renderer.
 * Seules les fonctions exposées ici sont accessibles depuis React,
 * via `window.api` (contextIsolation activé).
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { DashboardStats, LoginInput, LoginResult } from '@shared/types'

const api = {
  auth: {
    login: (input: LoginInput): Promise<LoginResult> => ipcRenderer.invoke(IPC.auth.login, input),
    logout: (utilisateurId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.auth.logout, utilisateurId)
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => ipcRenderer.invoke(IPC.dashboard.stats)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
