/**
 * Script de seed MIENRA.
 *
 * Par défaut : crée les utilisateurs de base, l'année scolaire active et les
 * classes standard (système ivoirien).
 *
 * Avec SEED_DEMO=1 : ajoute en plus des élèves, inscriptions et paiements de
 * démonstration pour visualiser le tableau de bord.
 *
 * Usage :
 *   npm run db:seed        # données de base uniquement
 *   npm run db:seed:demo   # données de base + démonstration
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/** Classes standard, dans l'ordre pédagogique. */
const CLASSES: { nom: string; niveau: string }[] = [
  { nom: 'Petite Section', niveau: 'MATERNELLE' },
  { nom: 'Moyenne Section', niveau: 'MATERNELLE' },
  { nom: 'Grande Section', niveau: 'MATERNELLE' },
  { nom: 'CP1', niveau: 'PRIMAIRE' },
  { nom: 'CP2', niveau: 'PRIMAIRE' },
  { nom: 'CE1', niveau: 'PRIMAIRE' },
  { nom: 'CE2', niveau: 'PRIMAIRE' },
  { nom: 'CM1', niveau: 'PRIMAIRE' },
  { nom: 'CM2', niveau: 'PRIMAIRE' },
  { nom: '6ème', niveau: 'COLLEGE' },
  { nom: '5ème', niveau: 'COLLEGE' },
  { nom: '4ème', niveau: 'COLLEGE' },
  { nom: '3ème', niveau: 'COLLEGE' },
  { nom: 'Seconde', niveau: 'LYCEE' },
  { nom: 'Première', niveau: 'LYCEE' },
  { nom: 'Terminale', niveau: 'LYCEE' }
]

async function seedBase(): Promise<void> {
  // Utilisateurs par défaut (mots de passe à changer à la première connexion).
  const utilisateurs = [
    { nom: 'Administrateur', identifiant: 'admin', motDePasse: 'admin123', role: 'ADMINISTRATEUR' },
    { nom: 'Directeur', identifiant: 'directeur', motDePasse: 'directeur123', role: 'DIRECTEUR' },
    { nom: 'Secrétaire', identifiant: 'secretaire', motDePasse: 'secretaire123', role: 'SECRETAIRE_COMPTABLE' }
  ]
  for (const u of utilisateurs) {
    await prisma.utilisateur.upsert({
      where: { identifiant: u.identifiant },
      update: {},
      create: {
        nom: u.nom,
        identifiant: u.identifiant,
        motDePasse: await bcrypt.hash(u.motDePasse, 10),
        role: u.role
      }
    })
  }

  // Paramètres de l'établissement : ligne unique, non configurée par défaut.
  // Chaque école renseigne son identité via l'assistant de bienvenue
  // (le mode démo la pré-remplit, voir seedDemo).
  await prisma.parametresEcole.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  })

  // Année scolaire active.
  await prisma.anneeScolaire.upsert({
    where: { libelle: '2025-2026' },
    update: {},
    create: { libelle: '2025-2026', active: true }
  })

  // Classes standard.
  for (let i = 0; i < CLASSES.length; i++) {
    await prisma.classe.upsert({
      where: { nom: CLASSES[i].nom },
      update: {},
      create: { ...CLASSES[i], ordre: i }
    })
  }
}

async function seedDemo(): Promise<void> {
  // École de démonstration déjà configurée (pas d'assistant au lancement).
  await prisma.parametresEcole.update({
    where: { id: 1 },
    data: {
      nom: 'Groupe Scolaire MIENRA',
      adresse: 'Yopougon, Abidjan, Côte d’Ivoire',
      telephone: '+225 07 00 00 00 00',
      email: 'contact@gs-mienra.ci',
      code: 'MIENRA',
      configuree: true
    }
  })

  const annee = await prisma.anneeScolaire.findFirstOrThrow({ where: { active: true } })
  const classes = await prisma.classe.findMany({ orderBy: { ordre: 'asc' } })
  const caissier = await prisma.utilisateur.findUniqueOrThrow({ where: { identifiant: 'secretaire' } })

  const noms = ['Kouassi', 'Koné', 'Traoré', 'Yao', 'N’Guessan', 'Ouattara', 'Bamba', 'Koffi', 'Diabaté', 'Aka']
  const prenomsM = ['Jean', 'Yves', 'Franck', 'Serge', 'Cédric']
  const prenomsF = ['Awa', 'Mariam', 'Grâce', 'Estelle', 'Aïcha']

  let compteurMatricule = 1
  let compteurRecu = 1

  for (let i = 0; i < 20; i++) {
    const sexe = i % 2 === 0 ? 'M' : 'F'
    const prenom = sexe === 'M' ? prenomsM[i % prenomsM.length] : prenomsF[i % prenomsF.length]
    const matricule = `MIENRA-2026-${String(compteurMatricule++).padStart(4, '0')}`

    const eleve = await prisma.eleve.upsert({
      where: { matricule },
      update: {},
      create: {
        matricule,
        nom: noms[i % noms.length],
        prenom,
        sexe,
        dateNaissance: new Date(2012 - (i % 6), i % 12, (i % 27) + 1),
        lieuNaissance: 'Abidjan',
        nationalite: 'Ivoirienne',
        telephoneParent: `07 0${i} 45 6${i % 10} 2${i % 10}`,
        nomParent: `${noms[(i + 3) % noms.length]} Parent`,
        adresse: 'Yopougon, Abidjan'
      }
    })

    const classe = classes[(i + 3) % classes.length]
    const scolarite = 150_000 + (i % 4) * 50_000
    const fraisInscription = 25_000
    const autresFrais = 10_000

    const inscription = await prisma.inscription.upsert({
      where: { eleveId_anneeScolaireId: { eleveId: eleve.id, anneeScolaireId: annee.id } },
      update: {},
      create: {
        eleveId: eleve.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
        scolarite,
        fraisInscription,
        autresFrais,
        montantTotal: scolarite + fraisInscription + autresFrais,
        dateInscription: new Date(2025, 8, 1 + (i % 20)) // septembre 2025
      }
    })

    // Paiements étalés sur l'année (certains élèves restent en impayés).
    const nbPaiements = i % 4 // 0 à 3 versements
    const modes = ['ESPECES', 'MOBILE_MONEY', 'BANQUE', 'CHEQUE']
    for (let p = 0; p < nbPaiements; p++) {
      const numeroRecu = `REC-2026-${String(compteurRecu++).padStart(5, '0')}`
      const existant = await prisma.paiement.findUnique({ where: { numeroRecu } })
      if (existant) continue
      await prisma.paiement.create({
        data: {
          inscriptionId: inscription.id,
          montant: 50_000 * (p + 1),
          mode: modes[(i + p) % modes.length],
          numeroRecu,
          caissierId: caissier.id,
          // Paiements répartis d'octobre 2025 à juin 2026.
          datePaiement: new Date(2025, 9 + ((i + p * 3) % 9), 5 + (i % 20))
        }
      })
    }
  }
}

async function main(): Promise<void> {
  await seedBase()
  console.log('✔ Données de base créées (utilisateurs, année scolaire, classes)')

  if (process.env.SEED_DEMO === '1') {
    await seedDemo()
    console.log('✔ Données de démonstration créées (élèves, inscriptions, paiements)')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
