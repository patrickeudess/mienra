/**
 * Preload : pont sécurisé entre le processus principal et le renderer.
 * Seules les fonctions exposées ici sont accessibles depuis React,
 * via `window.api` (contextIsolation activé).
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AnneeScolaireInput,
  AnneeScolaireRef,
  ClasseDetail,
  ClasseInput,
  ClasseRef,
  DashboardStats,
  EcoleInfo,
  EcoleInput,
  EleveDetail,
  FormatExport,
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
  JournalListItem,
  JournalParams,
  LoginInput,
  LoginResult,
  OperationResult,
  Paginated,
  PaiementInput,
  PaiementListItem,
  PaiementListParams,
  RapportData,
  RapportParams,
  SauvegardeInfo,
  UtilisateurInput,
  UtilisateurListItem,
  UtilisateurRef,
  UtilisateurUpdate
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
  },
  rapports: {
    generer: (params: RapportParams): Promise<OperationResult<RapportData>> =>
      ipcRenderer.invoke(IPC.rapports.generer, params),
    exporter: (
      params: RapportParams,
      format: FormatExport,
      auteurId: number
    ): Promise<OperationResult<{ chemin: string }>> =>
      ipcRenderer.invoke(IPC.rapports.exporter, params, format, auteurId)
  },
  utilisateurs: {
    list: (auteurId: number): Promise<OperationResult<UtilisateurListItem[]>> =>
      ipcRenderer.invoke(IPC.utilisateurs.list, auteurId),
    create: (input: UtilisateurInput, auteurId: number): Promise<OperationResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.utilisateurs.create, input, auteurId),
    update: (id: number, input: UtilisateurUpdate, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.utilisateurs.update, id, input, auteurId),
    setActif: (id: number, actif: boolean, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.utilisateurs.setActif, id, actif, auteurId),
    resetMotDePasse: (
      id: number,
      motDePasse: string,
      auteurId: number
    ): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.utilisateurs.resetMotDePasse, id, motDePasse, auteurId)
  },
  journal: {
    list: (
      params: JournalParams,
      auteurId: number
    ): Promise<OperationResult<Paginated<JournalListItem>>> =>
      ipcRenderer.invoke(IPC.journal.list, params, auteurId),
    utilisateurs: (auteurId: number): Promise<OperationResult<UtilisateurRef[]>> =>
      ipcRenderer.invoke(IPC.journal.utilisateurs, auteurId)
  },
  parametres: {
    ecoleGet: (): Promise<EcoleInfo> => ipcRenderer.invoke(IPC.parametres.ecoleGet),
    ecoleUpdate: (input: EcoleInput, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.parametres.ecoleUpdate, input, auteurId),
    anneeCreate: (
      input: AnneeScolaireInput,
      auteurId: number
    ): Promise<OperationResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.parametres.anneeCreate, input, auteurId),
    anneeActiver: (id: number, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.parametres.anneeActiver, id, auteurId),
    classesList: (): Promise<ClasseDetail[]> => ipcRenderer.invoke(IPC.parametres.classesList),
    classeCreate: (input: ClasseInput, auteurId: number): Promise<OperationResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.parametres.classeCreate, input, auteurId),
    classeUpdate: (id: number, input: ClasseInput, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.parametres.classeUpdate, id, input, auteurId),
    classeDelete: (id: number, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.parametres.classeDelete, id, auteurId)
  },
  sauvegardes: {
    list: (auteurId: number): Promise<OperationResult<SauvegardeInfo[]>> =>
      ipcRenderer.invoke(IPC.sauvegardes.list, auteurId),
    creer: (auteurId: number): Promise<OperationResult<{ nom: string }>> =>
      ipcRenderer.invoke(IPC.sauvegardes.creer, auteurId),
    restaurer: (nom: string, auteurId: number): Promise<OperationResult<null>> =>
      ipcRenderer.invoke(IPC.sauvegardes.restaurer, nom, auteurId),
    exporter: (auteurId: number): Promise<OperationResult<{ chemin: string } | null>> =>
      ipcRenderer.invoke(IPC.sauvegardes.exporter, auteurId)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
