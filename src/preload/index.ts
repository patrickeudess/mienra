/**
 * Preload : pont sécurisé entre le processus principal et le renderer.
 * Seules les fonctions exposées ici sont accessibles depuis React,
 * via `window.api` (contextIsolation activé).
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AnneeScolaireRef,
  ClasseRef,
  DashboardStats,
  EleveDetail,
  EleveInput,
  EleveListItem,
  EleveListParams,
  HistoriquePaiements,
  ImpayesParams,
  ImpayesResult,
  InscriptionInput,
  InscriptionListItem,
  InscriptionListParams,
  InscriptionUpdate,
  LoginInput,
  LoginResult,
  OperationResult,
  Paginated,
  PaiementInput,
  PaiementListItem,
  PaiementListParams
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
  },
  referentiel: {
    classes: (): Promise<ClasseRef[]> => ipcRenderer.invoke(IPC.referentiel.classes),
    annees: (): Promise<AnneeScolaireRef[]> => ipcRenderer.invoke(IPC.referentiel.annees)
  },
  inscriptions: {
    list: (params: InscriptionListParams): Promise<Paginated<InscriptionListItem>> =>
      ipcRenderer.invoke(IPC.inscriptions.list, params),
    create: (input: InscriptionInput, auteurId: number): Promise<OperationResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.inscriptions.create, input, auteurId),
    update: (
      id: number,
      input: InscriptionUpdate,
      auteurId: number
    ): Promise<OperationResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.inscriptions.update, id, input, auteurId),
    delete: (id: number, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.inscriptions.delete, id, auteurId)
  },
  paiements: {
    list: (params: PaiementListParams): Promise<Paginated<PaiementListItem>> =>
      ipcRenderer.invoke(IPC.paiements.list, params),
    create: (
      input: PaiementInput,
      auteurId: number
    ): Promise<OperationResult<{ id: number; numeroRecu: string; reste: number }>> =>
      ipcRenderer.invoke(IPC.paiements.create, input, auteurId),
    historique: (inscriptionId: number): Promise<OperationResult<HistoriquePaiements>> =>
      ipcRenderer.invoke(IPC.paiements.historique, inscriptionId),
    delete: (id: number, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.paiements.delete, id, auteurId)
  },
  recus: {
    imprimer: (paiementId: number, auteurId: number): Promise<OperationResult<{ chemin: string }>> =>
      ipcRenderer.invoke(IPC.recus.imprimer, paiementId, auteurId),
    ouvrirDossier: (): Promise<void> => ipcRenderer.invoke(IPC.recus.ouvrirDossier)
  },
  impayes: {
    list: (params: ImpayesParams): Promise<ImpayesResult> =>
      ipcRenderer.invoke(IPC.impayes.list, params)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
