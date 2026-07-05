/**
 * Génération automatique du numéro de reçu : REC-<année>-<séquence>.
 * L'année est celle de fin de l'année scolaire de l'inscription payée,
 * la séquence est incrémentée sur 5 chiffres : REC-2026-00001.
 */
import type { Prisma } from '@prisma/client'

/**
 * Calcule le prochain numéro de reçu. À appeler dans la transaction qui
 * crée le paiement, pour garantir l'unicité de la séquence.
 */
export async function genererNumeroRecu(
  tx: Prisma.TransactionClient,
  libelleAnneeScolaire: string
): Promise<string> {
  const fin = Number(libelleAnneeScolaire.split('-')[1])
  const annee = Number.isNaN(fin) ? new Date().getFullYear() : fin

  const prefixe = `REC-${annee}-`
  // Tri lexicographique valide : la séquence est à largeur fixe.
  const dernier = await tx.paiement.findFirst({
    where: { numeroRecu: { startsWith: prefixe } },
    orderBy: { numeroRecu: 'desc' },
    select: { numeroRecu: true }
  })

  const sequence = dernier ? Number(dernier.numeroRecu.slice(prefixe.length)) + 1 : 1
  return `${prefixe}${String(sequence).padStart(5, '0')}`
}
