/**
 * Agrégation des impayés, partagée entre la page Impayés et les rapports.
 * Le filtre « reste > 0 » porte sur une somme de paiements : il ne peut pas
 * s'exprimer dans un `where` Prisma, l'agrégation se fait donc en mémoire
 * (volumétrie d'un établissement scolaire, sans enjeu de performance).
 */
import type { PrismaClient } from '@prisma/client'
import { niveauSchema, type ImpayeListItem, type Niveau } from '@shared/types'

export interface FiltresImpayes {
  recherche?: string
  classeId?: number
  niveau?: Niveau
  anneeScolaireId?: number
}

/** Retourne les impayés filtrés, triés par reste décroissant. */
export async function calculerImpayes(
  prisma: PrismaClient,
  filtres: FiltresImpayes
): Promise<ImpayeListItem[]> {
  const { recherche, classeId, niveau, anneeScolaireId } = filtres

  const inscriptions = await prisma.inscription.findMany({
    where: {
      ...(classeId ? { classeId } : {}),
      ...(niveau ? { classe: { niveau } } : {}),
      ...(anneeScolaireId ? { anneeScolaireId } : {}),
      ...(recherche
        ? {
            eleve: {
              OR: [
                { matricule: { contains: recherche } },
                { nom: { contains: recherche } },
                { prenom: { contains: recherche } }
              ]
            }
          }
        : {})
    },
    include: {
      eleve: { select: { matricule: true, nom: true, prenom: true } },
      classe: { select: { nom: true, niveau: true } },
      anneeScolaire: { select: { libelle: true } },
      paiements: { select: { montant: true } }
    }
  })

  const impayes: ImpayeListItem[] = []
  for (const i of inscriptions) {
    const paye = i.paiements.reduce((somme, p) => somme + p.montant, 0)
    const reste = i.montantTotal - paye
    if (reste <= 0) continue

    impayes.push({
      inscriptionId: i.id,
      matricule: i.eleve.matricule,
      nomComplet: `${i.eleve.nom} ${i.eleve.prenom}`,
      classe: i.classe.nom,
      niveau: niveauSchema.catch('PRIMAIRE').parse(i.classe.niveau),
      anneeScolaire: i.anneeScolaire.libelle,
      montantAttendu: i.montantTotal,
      montantPaye: paye,
      reste,
      pourcentagePaye: i.montantTotal > 0 ? Math.floor((paye / i.montantTotal) * 100) : 0
    })
  }

  // Les plus gros restes en premier : ce sont les dossiers à relancer.
  impayes.sort((a, b) => b.reste - a.reste)
  return impayes
}
