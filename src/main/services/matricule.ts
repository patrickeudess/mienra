/**
 * Génération automatique du matricule élève : MIENRA-<année>-<séquence>.
 * L'année est l'année de fin de l'année scolaire active (ex. "2025-2026"
 * → 2026), la séquence est incrémentée sur 4 chiffres : MIENRA-2026-0001.
 */
import type { Prisma } from '@prisma/client'

/**
 * Calcule le prochain matricule disponible. À appeler dans la transaction
 * qui crée l'élève, pour garantir l'unicité de la séquence.
 */
export async function genererMatricule(tx: Prisma.TransactionClient): Promise<string> {
  const anneeActive = await tx.anneeScolaire.findFirst({ where: { active: true } })

  // Année de référence : fin de l'année scolaire active, sinon année civile.
  let annee = new Date().getFullYear()
  if (anneeActive) {
    const fin = Number(anneeActive.libelle.split('-')[1])
    if (!Number.isNaN(fin)) annee = fin
  }

  const prefixe = `MIENRA-${annee}-`
  // Le dernier matricule du préfixe donne la séquence courante
  // (tri lexicographique valide car la séquence est à largeur fixe).
  const dernier = await tx.eleve.findFirst({
    where: { matricule: { startsWith: prefixe } },
    orderBy: { matricule: 'desc' },
    select: { matricule: true }
  })

  const sequence = dernier ? Number(dernier.matricule.slice(prefixe.length)) + 1 : 1
  return `${prefixe}${String(sequence).padStart(4, '0')}`
}
