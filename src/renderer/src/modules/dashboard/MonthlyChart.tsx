/**
 * Graphique mensuel des encaissements (année scolaire : septembre → août).
 * Une seule série : pas de légende, le titre de la carte nomme la mesure.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { EncaissementMensuel } from '@shared/types'
import { formatFCFA } from '@/lib/format'

/** Couleur unique de la série (validée : contraste et lisibilité). */
const COULEUR_SERIE = '#3364ab'

/** Abrège les montants de l'axe Y : 1 500 000 → "1,5 M". */
function abregerMontant(valeur: number): string {
  if (valeur >= 1_000_000) return `${(valeur / 1_000_000).toLocaleString('fr-FR')} M`
  if (valeur >= 1_000) return `${(valeur / 1_000).toLocaleString('fr-FR')} k`
  return String(valeur)
}

interface MonthlyChartProps {
  donnees: EncaissementMensuel[]
}

export function MonthlyChart({ donnees }: MonthlyChartProps): JSX.Element {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={donnees} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="libelle"
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={abregerMontant}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'rgba(51, 100, 171, 0.08)' }}
            formatter={(valeur) => [formatFCFA(Number(valeur)), 'Encaissé']}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 13
            }}
          />
          <Bar
            dataKey="montant"
            fill={COULEUR_SERIE}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            name="Encaissé"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
