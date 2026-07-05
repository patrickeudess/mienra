/**
 * Module Paramètres (Administrateur) :
 * - informations de l'école (nom, adresse, téléphone, logo des reçus) ;
 * - années scolaires (création, activation — une seule active) ;
 * - classes (création, modification, suppression si aucune inscription).
 */
import { useCallback, useEffect, useState } from 'react'
import type { AnneeScolaireRef, ClasseDetail, EcoleInfo, Niveau } from '@shared/types'
import { NIVEAU_LABELS, NIVEAUX } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { EcoleForm } from './EcoleForm'

const CHAMP =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function ParametresPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)

  // ------------------------------------------------------------------ école
  const [ecole, setEcole] = useState<EcoleInfo | null>(null)

  // ------------------------------------------------------ années et classes
  const [annees, setAnnees] = useState<AnneeScolaireRef[]>([])
  const [nouvelleAnnee, setNouvelleAnnee] = useState('')
  const [classes, setClasses] = useState<ClasseDetail[]>([])
  const [classeEnEdition, setClasseEnEdition] = useState<ClasseDetail | null>(null)
  const [formClasse, setFormClasse] = useState<{ nom: string; niveau: Niveau; ordre: number }>({
    nom: '',
    niveau: 'PRIMAIRE',
    ordre: 0
  })
  const [modalClasse, setModalClasse] = useState(false)

  const charger = useCallback(async (): Promise<void> => {
    const [infosEcole, listeAnnees, listeClasses] = await Promise.all([
      window.api.parametres.ecoleGet(),
      window.api.referentiel.annees(),
      window.api.parametres.classesList()
    ])
    setEcole(infosEcole)
    setAnnees(listeAnnees)
    setClasses(listeClasses)
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  if (utilisateur?.role !== 'ADMINISTRATEUR') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Paramètres</h1>
        <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          Ce module est réservé à l&apos;administrateur.
        </p>
      </div>
    )
  }

  const creerAnnee = async (): Promise<void> => {
    const resultat = await window.api.parametres.anneeCreate({ libelle: nouvelleAnnee }, utilisateur.id)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Année scolaire ${nouvelleAnnee} créée.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    if (resultat.ok) {
      setNouvelleAnnee('')
      await charger()
    }
  }

  const activerAnnee = async (annee: AnneeScolaireRef): Promise<void> => {
    const resultat = await window.api.parametres.anneeActiver(annee.id, utilisateur.id)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Année ${annee.libelle} activée : c'est elle qui cadre le tableau de bord et les nouveaux matricules.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    await charger()
  }

  const ouvrirClasse = (classe?: ClasseDetail): void => {
    setClasseEnEdition(classe ?? null)
    setFormClasse(
      classe
        ? { nom: classe.nom, niveau: classe.niveau, ordre: classe.ordre }
        : { nom: '', niveau: 'PRIMAIRE', ordre: classes.length }
    )
    setModalClasse(true)
  }

  const enregistrerClasse = async (): Promise<void> => {
    const resultat = classeEnEdition
      ? await window.api.parametres.classeUpdate(classeEnEdition.id, formClasse, utilisateur.id)
      : await window.api.parametres.classeCreate(formClasse, utilisateur.id)
    if (!resultat.ok) {
      setMessage({ type: 'erreur', texte: resultat.erreur })
      return
    }
    setMessage({ type: 'succes', texte: classeEnEdition ? 'Classe modifiée.' : 'Classe créée.' })
    setModalClasse(false)
    await charger()
  }

  const supprimerClasse = async (classe: ClasseDetail): Promise<void> => {
    const resultat = await window.api.parametres.classeDelete(classe.id, utilisateur.id)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Classe ${classe.nom} supprimée.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    await charger()
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary-900">Paramètres</h1>

      {message && (
        <p
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === 'succes' ? 'bg-accent-50 text-accent-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.texte}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ------------------------------------------------------- école */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-base font-semibold text-primary-900">
            Identité de l&apos;établissement
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Ces informations apparaissent en en-tête des reçus et des rapports ; le code sert de
            préfixe aux matricules des élèves.
          </p>
          <EcoleForm
            ecole={ecole}
            onEnregistre={() => {
              setMessage({ type: 'succes', texte: 'Identité de l’établissement enregistrée.' })
              void charger()
            }}
          />
        </section>

        {/* --------------------------------------------- années scolaires */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-primary-900">Années scolaires</h2>
          <ul className="space-y-2">
            {annees.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {a.libelle}
                  {a.active && (
                    <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-xs text-accent-800">
                      active
                    </span>
                  )}
                </span>
                {!a.active && (
                  <button
                    type="button"
                    onClick={() => void activerAnnee(a)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
                  >
                    Activer
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <input
              value={nouvelleAnnee}
              onChange={(e) => setNouvelleAnnee(e.target.value)}
              placeholder="Ex. 2026-2027"
              className={CHAMP}
              aria-label="Nouvelle année scolaire"
            />
            <Button variant="secondaire" onClick={() => void creerAnnee()} disabled={!nouvelleAnnee}>
              Créer
            </Button>
          </div>
        </section>

        {/* ------------------------------------------------------- classes */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary-900">Classes</h2>
            <Button variant="secondaire" onClick={() => ouvrirClasse()}>
              + Ajouter
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-2 font-medium">Classe</th>
                  <th className="py-2 font-medium">Niveau</th>
                  <th className="py-2 text-right font-medium">Inscriptions</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 font-medium">{c.nom}</td>
                    <td className="py-2">{NIVEAU_LABELS[c.niveau]}</td>
                    <td className="py-2 text-right tabular-nums">{c.nbInscriptions}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => ouvrirClasse(c)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Modifier
                      </button>
                      {c.nbInscriptions === 0 && (
                        <button
                          type="button"
                          onClick={() => void supprimerClasse(c)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modale classe */}
      <Modal
        titre={classeEnEdition ? `Modifier — ${classeEnEdition.nom}` : 'Nouvelle classe'}
        ouvert={modalClasse}
        onFermer={() => setModalClasse(false)}
        largeur="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="nomClasse" className="mb-1 block text-sm font-medium text-gray-700">
              Nom de la classe *
            </label>
            <input
              id="nomClasse"
              className={CHAMP}
              value={formClasse.nom}
              onChange={(e) => setFormClasse({ ...formClasse, nom: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="niveauClasse" className="mb-1 block text-sm font-medium text-gray-700">
                Niveau *
              </label>
              <select
                id="niveauClasse"
                className={CHAMP}
                value={formClasse.niveau}
                onChange={(e) => setFormClasse({ ...formClasse, niveau: e.target.value as Niveau })}
              >
                {NIVEAUX.map((n) => (
                  <option key={n} value={n}>
                    {NIVEAU_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ordreClasse" className="mb-1 block text-sm font-medium text-gray-700">
                Ordre d&apos;affichage
              </label>
              <input
                id="ordreClasse"
                type="number"
                min="0"
                className={CHAMP}
                value={formClasse.ordre}
                onChange={(e) => setFormClasse({ ...formClasse, ordre: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="secondaire" onClick={() => setModalClasse(false)}>
              Annuler
            </Button>
            <Button onClick={() => void enregistrerClasse()} disabled={!formClasse.nom.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
