/**
 * Module Impayés : élèves n'ayant pas soldé leur scolarité, avec montant
 * attendu, payé, reste et pourcentage payé. Filtres par classe, niveau et
 * année scolaire ; totaux sur l'ensemble des lignes filtrées.
 */
import { useCallback, useEffect, useState } from 'react'
import type { AnneeScolaireRef, ClasseRef, ImpayesResult, Niveau } from '@shared/types'
import { NIVEAU_LABELS, NIVEAUX } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { formatFCFA, formatNombre } from '@/lib/format'

const PAR_PAGE = 15
const CHAMP_FILTRE =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function ImpayesPage(): JSX.Element {
  const [donnees, setDonnees] = useState<ImpayesResult | null>(null)
  const [classes, setClasses] = useState<ClasseRef[]>([])
  const [annees, setAnnees] = useState<AnneeScolaireRef[]>([])

  // Filtres : classe, niveau, année scolaire, recherche.
  const [recherche, setRecherche] = useState('')
  const [classeId, setClasseId] = useState<number | undefined>(undefined)
  const [niveau, setNiveau] = useState<Niveau | undefined>(undefined)
  const [anneeScolaireId, setAnneeScolaireId] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  useEffect(() => {
    void Promise.all([window.api.referentiel.classes(), window.api.referentiel.annees()]).then(
      ([listeClasses, listeAnnees]) => {
        setClasses(listeClasses)
        setAnnees(listeAnnees)
        setAnneeScolaireId(listeAnnees.find((a) => a.active)?.id)
      }
    )
  }, [])

  const charger = useCallback(async (): Promise<void> => {
    const resultat = await window.api.impayes.list({
      recherche,
      classeId,
      niveau,
      anneeScolaireId,
      page,
      parPage: PAR_PAGE
    })
    setDonnees(resultat)
  }, [recherche, classeId, niveau, anneeScolaireId, page])

  useEffect(() => {
    void charger()
  }, [charger])

  // Les classes proposées se restreignent au niveau choisi.
  const classesFiltrees = niveau ? classes.filter((c) => c.niveau === niveau) : classes
  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / PAR_PAGE)) : 1

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-900">Impayés</h1>
        {donnees && (
          <p className="text-sm text-gray-500">
            {formatNombre(donnees.total)} élève(s) en impayés pour les filtres choisis
          </p>
        )}
      </div>

      {/* Totaux des lignes filtrées */}
      {donnees && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard libelle="Élèves en impayés" valeur={formatNombre(donnees.total)} ton="attention" />
          <StatCard libelle="Montant attendu" valeur={formatFCFA(donnees.totaux.montantAttendu)} />
          <StatCard
            libelle="Montant payé"
            valeur={formatFCFA(donnees.totaux.montantPaye)}
            ton="positif"
          />
          <StatCard libelle="Reste à recouvrer" valeur={formatFCFA(donnees.totaux.reste)} ton="attention" />
        </div>
      )}

      {/* Filtres : classe, niveau, année scolaire */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value)
            setPage(1)
          }}
          placeholder="Rechercher un élève…"
          className={`${CHAMP_FILTRE} w-64`}
        />
        <select
          value={anneeScolaireId ?? ''}
          onChange={(e) => {
            setAnneeScolaireId(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par année scolaire"
        >
          <option value="">Toutes les années</option>
          {annees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.libelle}
              {a.active ? ' (active)' : ''}
            </option>
          ))}
        </select>
        <select
          value={niveau ?? ''}
          onChange={(e) => {
            const valeur = e.target.value ? (e.target.value as Niveau) : undefined
            setNiveau(valeur)
            setClasseId(undefined) // la classe choisie peut sortir du niveau
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par niveau"
        >
          <option value="">Tous les niveaux</option>
          {NIVEAUX.map((n) => (
            <option key={n} value={n}>
              {NIVEAU_LABELS[n]}
            </option>
          ))}
        </select>
        <select
          value={classeId ?? ''}
          onChange={(e) => {
            setClasseId(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par classe"
        >
          <option value="">Toutes les classes</option>
          {classesFiltrees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Élève</th>
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 font-medium">Niveau</th>
              <th className="px-4 py-3 text-right font-medium">Attendu</th>
              <th className="px-4 py-3 text-right font-medium">Payé</th>
              <th className="px-4 py-3 text-right font-medium">Reste</th>
              <th className="px-4 py-3 font-medium">% payé</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Aucun impayé pour les filtres choisis. 🎉
                </td>
              </tr>
            )}
            {donnees?.items.map((i) => (
              <tr key={i.inscriptionId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{i.nomComplet}</p>
                  <p className="font-mono text-xs text-gray-500">{i.matricule}</p>
                </td>
                <td className="px-4 py-2.5">{i.classe}</td>
                <td className="px-4 py-2.5">{NIVEAU_LABELS[i.niveau]}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatFCFA(i.montantAttendu)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-accent-700">
                  {formatFCFA(i.montantPaye)}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-700">
                  {formatFCFA(i.reste)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200"
                      role="progressbar"
                      aria-valuenow={i.pourcentagePaye}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-accent-500"
                        style={{ width: `${i.pourcentagePaye}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs tabular-nums text-gray-600">
                      {i.pourcentagePaye} %
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {donnees && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <p>
            Page {donnees.page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondaire" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ← Précédent
            </Button>
            <Button variant="secondaire" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Suivant →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
