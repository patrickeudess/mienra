/**
 * Module Sauvegardes (Administrateur) : liste des copies de la base
 * (automatiques à chaque fermeture + manuelles), sauvegarde immédiate,
 * restauration (l'application redémarre) et export de la base.
 */
import { useCallback, useEffect, useState } from 'react'
import type { SauvegardeInfo } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'

/** Taille lisible : 1536000 → "1,5 Mo". */
function formatTaille(octets: number): string {
  if (octets >= 1_000_000) return `${(octets / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
  if (octets >= 1_000) return `${Math.round(octets / 1_000)} Ko`
  return `${octets} o`
}

function formatDateHeure(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export function SauvegardesPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [sauvegardes, setSauvegardes] = useState<SauvegardeInfo[]>([])
  const [erreurAcces, setErreurAcces] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [restauration, setRestauration] = useState<SauvegardeInfo | null>(null)

  const charger = useCallback(async (): Promise<void> => {
    if (!utilisateur) return
    const resultat = await window.api.sauvegardes.list(utilisateur.id)
    if (!resultat.ok) {
      setErreurAcces(resultat.erreur)
      return
    }
    setSauvegardes(resultat.data)
  }, [utilisateur])

  useEffect(() => {
    void charger()
  }, [charger])

  const sauvegarderMaintenant = async (): Promise<void> => {
    if (!utilisateur) return
    setEnCours(true)
    const resultat = await window.api.sauvegardes.creer(utilisateur.id)
    setEnCours(false)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Sauvegarde créée : ${resultat.data.nom}` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    await charger()
  }

  const exporterBase = async (): Promise<void> => {
    if (!utilisateur) return
    const resultat = await window.api.sauvegardes.exporter(utilisateur.id)
    if (!resultat.ok) {
      setMessage({ type: 'erreur', texte: resultat.erreur })
      return
    }
    if (resultat.data) {
      setMessage({ type: 'succes', texte: `Base exportée vers ${resultat.data.chemin}` })
    }
  }

  const confirmerRestauration = async (): Promise<void> => {
    if (!restauration || !utilisateur) return
    const resultat = await window.api.sauvegardes.restaurer(restauration.nom, utilisateur.id)
    // En cas de succès l'application redémarre : on ne repasse ici qu'en échec.
    if (!resultat.ok) {
      setMessage({ type: 'erreur', texte: resultat.erreur })
      setRestauration(null)
    }
  }

  if (erreurAcces) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Sauvegardes</h1>
        <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          {erreurAcces}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Sauvegardes</h1>
          <p className="text-sm text-gray-500">
            Une copie est créée automatiquement à chaque fermeture : les 10 dernières sont conservées.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondaire" onClick={() => void exporterBase()}>
            Exporter la base…
          </Button>
          <Button onClick={() => void sauvegarderMaintenant()} disabled={enCours}>
            {enCours ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
          </Button>
        </div>
      </div>

      {message && (
        <p
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === 'succes' ? 'bg-accent-50 text-accent-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.texte}
        </p>
      )}

      {/* Liste des sauvegardes */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Fichier</th>
              <th className="px-4 py-3 font-medium">Créée le</th>
              <th className="px-4 py-3 text-right font-medium">Taille</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {sauvegardes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  Aucune sauvegarde pour le moment. Elles apparaîtront après la première fermeture
                  de l&apos;application ou une sauvegarde manuelle.
                </td>
              </tr>
            )}
            {sauvegardes.map((s, index) => (
              <tr key={s.nom} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-primary-800">
                  {s.nom}
                  {index === 0 && (
                    <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 font-sans text-xs text-accent-800">
                      la plus récente
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">{formatDateHeure(s.date)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatTaille(s.taille)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setRestauration(s)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    Restaurer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation de restauration */}
      <Modal
        titre="Restaurer cette sauvegarde ?"
        ouvert={restauration !== null}
        onFermer={() => setRestauration(null)}
        largeur="max-w-md"
      >
        {restauration && (
          <div>
            <p className="text-sm text-gray-700">
              La base actuelle sera remplacée par la sauvegarde du{' '}
              <strong>{formatDateHeure(restauration.date)}</strong>. Les données saisies après
              cette date disparaîtront de l&apos;application.
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Par précaution, une copie de la base actuelle est créée avant la restauration.
              L&apos;application redémarrera automatiquement.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondaire" onClick={() => setRestauration(null)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => void confirmerRestauration()}>
                Restaurer et redémarrer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
