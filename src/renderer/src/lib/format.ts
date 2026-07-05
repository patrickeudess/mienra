/** Fonctions de formatage partagées par l'interface. */

/** Formate un montant en FCFA : 300000 → "300 000 FCFA". */
export function formatFCFA(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`
}

/** Formate un nombre : 12345 → "12 345". */
export function formatNombre(n: number): string {
  return n.toLocaleString('fr-FR')
}

/** Formate une date ISO : "2012-03-14T…" → "14/03/2012". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}
