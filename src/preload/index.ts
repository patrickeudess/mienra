/**
 * Preload : pont sécurisé entre le processus principal et le renderer.
 * Seules les fonctions exposées ici sont accessibles depuis React,
 * via `window.api` (contextIsolation activé).
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  DashboardStats,
  EleveDetail,
  EleveInput,
  EleveListItem,
  EleveListParams,
  LoginInput,
  LoginResult,
  OperationResult,
  Paginated
} from '@shared/types'

const api = {
  auth: {
    login: (input: LoginInput): Promise<LoginResult> => ipcRenderer.invoke(IPC.auth.login, input),
    logout: (utilisateurId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.auth.logout, utilisateurId)
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => ipcRenderer.invoke(IPC.dashboard.stats)
  },
  eleves: {
    list: (params: EleveListParams): Promise<Paginated<EleveListItem>> =>
      ipcRenderer.invoke(IPC.eleves.list, params),
    get: (id: number): Promise<OperationResult<EleveDetail>> =>
      ipcRenderer.invoke(IPC.eleves.get, id),
    create: (
      input: EleveInput,
      auteurId: number
    ): Promise<OperationResult<{ id: number; matricule: string }>> =>
      ipcRenderer.invoke(IPC.eleves.create, input, auteurId),
    update: (
      id: number,
      input: EleveInput,
      auteurId: number
    ): Promise<OperationResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.eleves.update, id, input, auteurId),
    delete: (id: number, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.eleves.delete, id, auteurId)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
