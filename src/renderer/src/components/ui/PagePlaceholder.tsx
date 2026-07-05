/**
 * Page temporaire pour les modules pas encore développés.
 * Sera remplacée module par module au fil des étapes.
 */
interface PagePlaceholderProps {
  titre: string
}

export function PagePlaceholder({ titre }: PagePlaceholderProps): JSX.Element {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">{titre}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-gray-500">Ce module sera développé dans une prochaine étape.</p>
      </div>
    </div>
  )
}
