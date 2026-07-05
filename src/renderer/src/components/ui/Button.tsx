/**
 * Bouton réutilisable, décliné selon la charte MIENRA.
 * variant : primaire (bleu foncé), secondaire (blanc bordé), danger (rouge).
 */
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primaire' | 'secondaire' | 'danger'
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primaire: 'bg-primary-800 text-white hover:bg-primary-700',
  secondaire: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-500'
}

export function Button({ variant = 'primaire', className = '', ...props }: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  )
}
