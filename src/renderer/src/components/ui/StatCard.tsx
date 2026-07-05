/**
 * Carte de statistique du tableau de bord : un libellé + une valeur phare.
 * Le ton (couleur de la valeur) signale la nature de l'indicateur.
 */
interface StatCardProps {
  libelle: string
  valeur: string
  /** neutre = information, positif = encaissé, attention = impayés/solde. */
  ton?: 'neutre' | 'positif' | 'attention'
  /** Précision affichée sous la valeur (optionnelle). */
  detail?: string
}

const TONS: Record<NonNullable<StatCardProps['ton']>, string> = {
  neutre: 'text-primary-800',
  positif: 'text-accent-600',
  attention: 'text-amber-700'
}

export function StatCard({ libelle, valeur, ton = 'neutre', detail }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{libelle}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${TONS[ton]}`}>{valeur}</p>
      {detail && <p className="mt-0.5 text-xs text-gray-400">{detail}</p>}
    </div>
  )
}
