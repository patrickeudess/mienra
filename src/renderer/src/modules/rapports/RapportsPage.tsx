/**
 * Module Rapports : huit rapports prédéfinis (journalier, mensuel, annuel,
 * par classe, par niveau, Mobile Money, espèces, impayés), avec aperçu à
 * l'écran et export PDF / Excel en un clic.
 */
import { useEffect, useState } from 'react'
import type {
  AnneeScolaireRef,
  ClasseRef,
  FormatExport,
  Niveau,
  RapportData,
  RapportParams,
  TypeRapport
} from '@shared/types'
import {
  MODE_PAIEMENT_LABELS,
  NIVEAU_LABELS,
  NIVEAUX,
  TYPE_RAPPORT_LABELS,
  TYPES_RAPPORT
} from '@shared/types'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatFCFA, formatNombre } from '@/lib/format'

const CHAMP =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

/** Description courte affichée sur chaque carte de rapport. */
const DESCRIPTIONS: Record<TypeRapport, string> = {
  JOURNALIER: 'Encaissements d’une journée',
  MENSUEL: 'Encaissements d’un mois',
  ANNUEL: 'Encaissements d’une année scolaire',
  PAR_CLASSE: 'Encaissements d’une classe',
  PAR_NIVEAU: 'Encaissements d’un niveau',
  MOBILE_MONEY: 'Tous les paiements Mobile Money',
  ESPECES: 'Tous les paiements en espèces',
  IMPAYES: 'Élèves n’ayant pas soldé'
}

/** Valeurs par défaut des champs de paramétrage. */
function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10)
}
function moisCourant(): string {
  return new Date().toISOString().slice(0, 7)
}

export function RapportsPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [classes, setClasses] = useState<ClasseRef[]>([])
  const [annees, setAnnees] = useState<AnneeScolaireRef[]>([])

  // Paramètres du rapport en cours de préparation.
  const [type, setType] = useState<TypeRapport>('JOURNALIER')
  const [date, setDate] = useState(aujourdHui())
  const [mois, setMois] = useState(moisCourant())
  const [anneeScolaireId, setAnneeScolaireId] = useState<number | undefined>(undefined)
  const [classeId, setClasseId] = useState<number | undefined>(undefined)
  const [niveau, setNiveau] = useState<Niveau | undefined>(undefined)

  const [rapport, setRapport] = useState<RapportData | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [exportEnCours, setExportEnCours] = useState<FormatExport | null>(null)

  useEffect(() => {
    void Promise.all([window.api.referentiel.classes(), window.api.referentiel.annees()]).then(
      ([listeClasses, listeAnnees]) => {
        setClasses(listeClasses)
        setAnnees(listeAnnees)
        setAnneeScolaireId(listeAnnees.find((a) => a.active)?.id)
      }
    )
  }, [])

  /** Construit les paramètres selon le type choisi. */
  const construireParams = (): RapportParams => ({
    type,
    ...(type === 'JOURNALIER' ? { date } : {}),
    ...(type === 'MENSUEL' ? { mois } : {}),
    ...(anneeScolaireId ? { anneeScolaireId } : {}),
    ...(type === 'PAR_CLASSE' && classeId ? { classeId } : {}),
    ...(type === 'PAR_NIVEAU' && niveau ? { niveau } : {})
  })

  const afficher = async (): Promise<void> => {
    setErreur(null)
    setEnCours(true)
    const resultat = await window.api.rapports.generer(construireParams())
    setEnCours(false)
    if (!resultat.ok) {
      setErreur(resultat.erreur)
      setRapport(null)
      return
    }
    setRapport(resultat.data)
  }

  const exporter = async (format: FormatExport): Promise<void> => {
    if (!utilisateur) return
    setErreur(null)
    setExportEnCours(format)
    const resultat = await window.api.rapports.exporter(construireParams(), format, utilisateur.id)
    setExportEnCours(null)
    if (!resultat.ok) setErreur(resultat.erreur)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary-900">Rapports</h1>

      {/* Choix du rapport */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TYPES_RAPPORT.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t)
              setRapport(null)
              setErreur(null)
            }}
            className={`rounded-xl border p-3 text-left transition-colors ${
              type === t
                ? 'border-primary-600 bg-primary-50'
                : 'border-gray-200 bg-white hover:border-primary-300'
            }`}
          >
            <p className={`text-sm font-semibold ${type === t ? 'text-primary-900' : 'text-gray-800'}`}>
              {TYPE_RAPPORT_LABELS[t]}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{DESCRIPTIONS[t]}</p>
          </button>
        ))}
      </div>

      {/* Paramètres du rapport choisi */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {type === 'JOURNALIER' && (
          <div>
            <label htmlFor="date" className="mb-1 block text-xs font-medium text-gray-600">
              Date
            </label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
          </div>
        )}
        {type === 'MENSUEL' && (
          <div>
            <label htmlFor="mois" className="mb-1 block text-xs font-medium text-gray-600">
              Mois
            </label>
            <input id="mois" type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={CHAMP} />
          </div>
        )}
        {type === 'PAR_CLASSE' && (
          <div>
            <label htmlFor="classe" className="mb-1 block text-xs font-medium text-gray-600">
              Classe
            </label>
            <select
              id="classe"
              value={classeId ?? ''}
              onChange={(e) => setClasseId(e.target.value ? Number(e.target.value) : undefined)}
              className={CHAMP}
            >
              <option value="">Choisir…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === 'PAR_NIVEAU' && (
          <div>
            <label htmlFor="niveau" className="mb-1 block text-xs font-medium text-gray-600">
              Niveau
            </label>
            <select
              id="niveau"
              value={niveau ?? ''}
              onChange={(e) => setNiveau(e.target.value ? (e.target.value as Niveau) : undefined)}
              className={CHAMP}
            >
              <option value="">Choisir…</option>
              {NIVEAUX.map((n) => (
                <option key={n} value={n}>
                  {NIVEAU_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* L'année scolaire cadre tous les rapports sauf journalier/mensuel */}
        {type !== 'JOURNALIER' && type !== 'MENSUEL' && (
          <div>
            <label htmlFor="annee" className="mb-1 block text-xs font-medium text-gray-600">
              Année scolaire
            </label>
            <select
              id="annee"
              value={anneeScolaireId ?? ''}
              onChange={(e) => setAnneeScolaireId(e.target.value ? Number(e.target.value) : undefined)}
              className={CHAMP}
            >
              <option value="">Toutes</option>
              {annees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                  {a.active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button onClick={() => void afficher()} disabled={enCours}>
          {enCours ? 'Génération…' : 'Afficher le rapport'}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondaire"
            disabled={exportEnCours !== null}
            onClick={() => void exporter('pdf')}
          >
            {exportEnCours === 'pdf' ? 'Export…' : 'Exporter PDF'}
          </Button>
          <Button
            variant="secondaire"
            disabled={exportEnCours !== null}
            onClick={() => void exporter('excel')}
          >
            {exportEnCours === 'excel' ? 'Export…' : 'Exporter Excel'}
          </Button>
        </div>
      </div>

      {erreur && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>}

      {/* Aperçu */}
      {rapport && (
        <div className="mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-primary-900">{rapport.titre}</h2>
            <p className="text-sm text-gray-500">{rapport.sousTitre}</p>
          </div>

          {/* Totaux */}
          {rapport.famille === 'PAIEMENTS' ? (
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard libelle="Paiements" valeur={formatNombre(rapport.totaux.nombre)} />
              <StatCard
                libelle="Total encaissé"
                valeur={formatFCFA(rapport.totaux.montant)}
                ton="positif"
              />
              {rapport.totaux.parMode.slice(0, 2).map((m) => (
                <StatCard
                  key={m.mode}
                  libelle={MODE_PAIEMENT_LABELS[m.mode]}
                  valeur={formatFCFA(m.montant)}
                />
              ))}
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard libelle="Élèves en impayés" valeur={formatNombre(rapport.totaux.nombre)} ton="attention" />
              <StatCard libelle="Attendu" valeur={formatFCFA(rapport.totaux.montantAttendu)} />
              <StatCard libelle="Payé" valeur={formatFCFA(rapport.totaux.montantPaye)} ton="positif" />
              <StatCard libelle="Reste à recouvrer" valeur={formatFCFA(rapport.totaux.reste)} ton="attention" />
            </div>
          )}

          {/* Tableau d'aperçu */}
          <div className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                {rapport.famille === 'PAIEMENTS' ? (
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-medium">N° reçu</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Élève</th>
                    <th className="px-4 py-3 font-medium">Classe</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 text-right font-medium">Montant</th>
                  </tr>
                ) : (
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-medium">Élève</th>
                    <th className="px-4 py-3 font-medium">Classe</th>
                    <th className="px-4 py-3 text-right font-medium">Attendu</th>
                    <th className="px-4 py-3 text-right font-medium">Payé</th>
                    <th className="px-4 py-3 text-right font-medium">Reste</th>
                    <th className="px-4 py-3 text-right font-medium">% payé</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {rapport.lignes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      Aucune donnée pour les critères choisis.
                    </td>
                  </tr>
                )}
                {rapport.famille === 'PAIEMENTS'
                  ? rapport.lignes.map((l) => (
                      <tr key={l.numeroRecu} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-primary-800">{l.numeroRecu}</td>
                        <td className="px-4 py-2">{formatDate(l.date)}</td>
                        <td className="px-4 py-2">
                          {l.nomComplet}{' '}
                          <span className="font-mono text-xs text-gray-400">{l.matricule}</span>
                        </td>
                        <td className="px-4 py-2">{l.classe}</td>
                        <td className="px-4 py-2">{MODE_PAIEMENT_LABELS[l.mode]}</td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">
                          {formatFCFA(l.montant)}
                        </td>
                      </tr>
                    ))
                  : rapport.lignes.map((l) => (
                      <tr key={l.matricule} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2">
                          {l.nomComplet}{' '}
                          <span className="font-mono text-xs text-gray-400">{l.matricule}</span>
                        </td>
                        <td className="px-4 py-2">{l.classe}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatFCFA(l.montantAttendu)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-accent-700">
                          {formatFCFA(l.montantPaye)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums text-amber-700">
                          {formatFCFA(l.reste)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{l.pourcentagePaye} %</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
