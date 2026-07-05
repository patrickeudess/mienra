/**
 * Service du journal d'activité : chaque action sensible est tracée en base
 * (date, utilisateur, action, détails, nom du poste).
 */
import os from 'os'
import { getPrisma } from '../database/client'
import type { ActionJournal } from '@shared/types'

/** Enregistre une entrée dans le journal d'activité. */
export async function journaliser(
  action: ActionJournal,
  options: { utilisateurId?: number; details?: string } = {}
): Promise<void> {
  const prisma = getPrisma()
  await prisma.journalActivite.create({
    data: {
      action,
      utilisateurId: options.utilisateurId ?? null,
      details: options.details ?? '',
      poste: os.hostname()
    }
  })
}
