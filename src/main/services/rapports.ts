/**
 * Moteur de rapports : transforme des paramètres (type + filtres) en données
 * prêtes à afficher ou à exporter. Découplé d'Electron : testable hors
 * application. Les erreurs de paramétrage sont levées avec un message
 * en français, remonté tel quel à l'interface.
 */
import type { PrismaClient } from '@prisma/client'
import {
  MODE_PAIEMENT_LABELS,
  MODES_PAIEMENT,
  modePaiementSchema,
  NIVEAU_LABELS,
  TYPE_RAPPORT_LABELS,
  type ModePaiement,
  type RapportData,
  type RapportLignePaiement,
  type RapportParams
} from '@shared/types'
import { calculerImpayes } from './impayes'

function dateFr(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR')
}

const MOIS_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

export async function genererRapport(
  prisma: PrismaClient,
  params: RapportParams
): Promise<RapportData> {
  // ------------------------------------------------ période selon le type
  let du: Date | undefined
  let au: Date | undefined // borne exclusive
  if (params.type === 'JOURNALIER') {
    if (!params.date) throw new Error('Choisissez la date du rapport journalier.')
    du = new Date(`${params.date}T00:00:00`)
    au = new Date(du)
    au.setDate(au.getDate() + 1)
  }
  if (params.type === 'MENSUEL') {
    if (!params.mois) throw new Error('Choisissez le mois du rapport mensuel.')
    const [annee, mois] = params.mois.split('-').map(Number)
    du = new Date(annee, mois - 1, 1)
    au = new Date(annee, mois, 1)
  }
  if (params.type === 'ANNUEL' && !params.anneeScolaireId) {
    throw new Error("Choisissez l'année scolaire du rapport annuel.")
  }
  if (params.type === 'PAR_CLASSE' && !params.classeId) {
    throw new Error('Choisissez la classe du rapport.')
  }
  if (params.type === 'PAR_NIVEAU' && !params.niveau) {
    throw new Error('Choisissez le niveau du rapport.')
  }
  const mode: ModePaiement | undefined =
    params.type === 'MOBILE_MONEY' ? 'MOBILE_MONEY' : params.type === 'ESPECES' ? 'ESPECES' : undefined

  // ------------------------------------------------------------ sous-titre
  const morceaux: string[] = []
  if (params.type === 'JOURNALIER' && params.date) morceaux.push(`Journée du ${dateFr(params.date)}`)
  if (params.type === 'MENSUEL' && params.mois) {
    const [annee, mois] = params.mois.split('-').map(Number)
    morceaux.push(`Mois de ${MOIS_LONGS[mois - 1]} ${annee}`)
  }
  if (params.anneeScolaireId) {
    const annee = await prisma.anneeScolaire.findUnique({ where: { id: params.anneeScolaireId } })
    if (annee) morceaux.push(`Année scolaire ${annee.libelle}`)
  }
  if (params.classeId) {
    const classe = await prisma.classe.findUnique({ where: { id: params.classeId } })
    if (classe) morceaux.push(`Classe ${classe.nom}`)
  }
  if (params.niveau) morceaux.push(`Niveau ${NIVEAU_LABELS[params.niveau]}`)
  if (mode) morceaux.push(`Mode ${MODE_PAIEMENT_LABELS[mode]}`)
  const sousTitre = morceaux.join(' — ') || 'Toutes périodes confondues'

  const commun = {
    type: params.type,
    titre: TYPE_RAPPORT_LABELS[params.type],
    sousTitre,
    genereLe: new Date().toISOString()
  }

  // ------------------------------------------------------ rapport impayés
  if (params.type === 'IMPAYES') {
    const lignes = await calculerImpayes(prisma, {
      classeId: params.classeId,
      niveau: params.niveau,
      anneeScolaireId: params.anneeScolaireId
    })
    const totaux = lignes.reduce(
      (t, l) => ({
        nombre: t.nombre + 1,
        montantAttendu: t.montantAttendu + l.montantAttendu,
        montantPaye: t.montantPaye + l.montantPaye,
        reste: t.reste + l.reste
      }),
      { nombre: 0, montantAttendu: 0, montantPaye: 0, reste: 0 }
    )
    return {
      ...commun,
      famille: 'IMPAYES',
      lignes: lignes.map(({ inscriptionId: _inscriptionId, niveau: _niveau, anneeScolaire: _a, ...l }) => l),
      totaux
    }
  }

  // --------------------------------------------------- rapports paiements
  const paiements = await prisma.paiement.findMany({
    where: {
      ...(du && au ? { datePaiement: { gte: du, lt: au } } : {}),
      ...(mode ? { mode } : {}),
      inscription: {
        ...(params.anneeScolaireId ? { anneeScolaireId: params.anneeScolaireId } : {}),
        ...(params.classeId ? { classeId: params.classeId } : {}),
        ...(params.niveau ? { classe: { niveau: params.niveau } } : {})
      }
    },
    orderBy: { datePaiement: 'asc' },
    include: {
      inscription: {
        include: {
          eleve: { select: { matricule: true, nom: true, prenom: true } },
          classe: { select: { nom: true } }
        }
      }
    }
  })

  const lignes: RapportLignePaiement[] = paiements.map((p) => ({
    numeroRecu: p.numeroRecu,
    date: p.datePaiement.toISOString(),
    matricule: p.inscription.eleve.matricule,
    nomComplet: `${p.inscription.eleve.nom} ${p.inscription.eleve.prenom}`,
    classe: p.inscription.classe.nom,
    mode: modePaiementSchema.catch('ESPECES').parse(p.mode),
    montant: p.montant
  }))

  const parModeMap = new Map<ModePaiement, number>(MODES_PAIEMENT.map((m) => [m, 0]))
  let montant = 0
  for (const l of lignes) {
    montant += l.montant
    parModeMap.set(l.mode, (parModeMap.get(l.mode) ?? 0) + l.montant)
  }

  return {
    ...commun,
    famille: 'PAIEMENTS',
    lignes,
    totaux: {
      nombre: lignes.length,
      montant,
      // Seuls les modes réellement utilisés apparaissent dans les totaux.
      parMode: [...parModeMap.entries()]
        .filter(([, m]) => m > 0)
        .map(([modePaiement, montantMode]) => ({ mode: modePaiement, montant: montantMode }))
    }
  }
}
