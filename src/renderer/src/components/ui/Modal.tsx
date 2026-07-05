/**
 * Fenêtre modale générique : voile sombre + panneau centré.
 * Fermeture par la croix, le voile ou la touche Échap.
 */
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  titre: string
  ouvert: boolean
  onFermer: () => void
  children: ReactNode
  /** Largeur maximale du panneau (classe Tailwind). */
  largeur?: string
}

export function Modal({ titre, ouvert, onFermer, children, largeur = 'max-w-2xl' }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!ouvert) return
    const onTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onTouche)
    return () => window.removeEventListener('keydown', onTouche)
  }, [ouvert, onFermer])

  if (!ouvert) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFermer()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`max-h-[90vh] w-full ${largeur} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-primary-900">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
