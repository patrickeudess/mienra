/**
 * Génération du reçu de paiement en PDF (pdf-lib) — format A5 paysage.
 *
 * Contenu : en-tête de l'école (logo si défini), numéro du reçu, élève
 * (nom, matricule, classe, année), montant payé, cumul, reste à payer,
 * mode de paiement, caissier, date et QR code de vérification.
 *
 * Le service est découplé d'Electron : il reçoit le client Prisma et le
 * dossier de sortie, ce qui le rend testable hors application.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import { MODE_PAIEMENT_LABELS, modePaiementSchema } from '@shared/types'

// Palette MIENRA.
const BLEU = rgb(0.082, 0.161, 0.278) // primary-900
const VERT = rgb(0.141, 0.482, 0.31) // accent-700
const GRIS = rgb(0.42, 0.45, 0.5)
const GRIS_CLAIR = rgb(0.93, 0.94, 0.95)

/**
 * Montant en FCFA avec espaces simples comme séparateurs de milliers.
 * (Les polices standard PDF n'encodent pas l'espace insécable de fr-FR.)
 */
function montantFCFA(n: number): string {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`
}

function dateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Ligne libellé / valeur du corps du reçu. */
function ligne(
  page: PDFPage,
  police: PDFFont,
  policeGras: PDFFont,
  y: number,
  libelle: string,
  valeur: string
): void {
  page.drawText(libelle, { x: 40, y, size: 10, font: police, color: GRIS })
  page.drawText(valeur, { x: 175, y, size: 10, font: policeGras, color: BLEU })
}

/**
 * Génère (ou régénère) le PDF du reçu d'un paiement.
 * Retourne le chemin absolu du fichier écrit.
 */
export async function genererRecuPdf(
  prisma: PrismaClient,
  paiementId: number,
  dossierSortie: string
): Promise<string> {
  const paiement = await prisma.paiement.findUniqueOrThrow({
    where: { id: paiementId },
    include: {
      caissier: { select: { nom: true } },
      inscription: {
        include: {
          eleve: { select: { matricule: true, nom: true, prenom: true } },
          classe: { select: { nom: true } },
          anneeScolaire: { select: { libelle: true } },
          paiements: { select: { id: true, montant: true, datePaiement: true } }
        }
      }
    }
  })
  const ecole = await prisma.parametresEcole.findFirst()

  // Cumul payé À LA DATE de ce paiement (les versements postérieurs sont
  // exclus pour que la réimpression d'un ancien reçu reste exacte).
  const versements = [...paiement.inscription.paiements].sort(
    (a, b) => a.datePaiement.getTime() - b.datePaiement.getTime() || a.id - b.id
  )
  let cumul = 0
  for (const v of versements) {
    cumul += v.montant
    if (v.id === paiement.id) break
  }
  const reste = paiement.inscription.montantTotal - cumul

  // ------------------------------------------------------------- document
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 420]) // A5 paysage
  const police = await pdf.embedFont(StandardFonts.Helvetica)
  const policeGras = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Bandeau d'en-tête.
  page.drawRectangle({ x: 0, y: 360, width: 595, height: 60, color: BLEU })

  // Logo de l'école (si défini et lisible), sinon monogramme.
  let logoAffiche = false
  if (ecole?.logo && fs.existsSync(ecole.logo)) {
    try {
      const octets = fs.readFileSync(ecole.logo)
      const image = ecole.logo.toLowerCase().endsWith('.png')
        ? await pdf.embedPng(octets)
        : await pdf.embedJpg(octets)
      const dims = image.scaleToFit(44, 44)
      page.drawImage(image, { x: 40, y: 368, width: dims.width, height: dims.height })
      logoAffiche = true
    } catch {
      // Logo illisible : on retombe sur le monogramme.
    }
  }
  if (!logoAffiche) {
    page.drawRectangle({ x: 40, y: 368, width: 44, height: 44, color: VERT })
    page.drawText('M', { x: 54, y: 380, size: 22, font: policeGras, color: rgb(1, 1, 1) })
  }

  page.drawText(ecole?.nom ?? 'MIENRA', {
    x: 96,
    y: 392,
    size: 15,
    font: policeGras,
    color: rgb(1, 1, 1)
  })
  const sousTitre = [ecole?.adresse, ecole?.telephone, ecole?.email].filter(Boolean).join('  :  ')
  if (sousTitre) {
    page.drawText(sousTitre, { x: 96, y: 375, size: 8.5, font: police, color: rgb(0.8, 0.85, 0.92) })
  }

  // Titre + numéro + date.
  page.drawText('REÇU DE PAIEMENT', { x: 40, y: 330, size: 16, font: policeGras, color: BLEU })
  page.drawText(paiement.numeroRecu, { x: 445, y: 332, size: 12, font: policeGras, color: VERT })
  page.drawText(`Date : ${dateFr(paiement.datePaiement)}`, {
    x: 445,
    y: 316,
    size: 9,
    font: police,
    color: GRIS
  })

  // Corps : informations élève et paiement.
  const eleve = paiement.inscription.eleve
  let y = 296
  const pas = 19
  ligne(page, police, policeGras, y, 'Élève', `${eleve.nom} ${eleve.prenom}`)
  ligne(page, police, policeGras, (y -= pas), 'Matricule', eleve.matricule)
  ligne(
    page,
    police,
    policeGras,
    (y -= pas),
    'Classe',
    `${paiement.inscription.classe.nom} : ${paiement.inscription.anneeScolaire.libelle}`
  )
  ligne(
    page,
    police,
    policeGras,
    (y -= pas),
    'Mode de paiement',
    MODE_PAIEMENT_LABELS[modePaiementSchema.catch('ESPECES').parse(paiement.mode)]
  )
  ligne(page, police, policeGras, (y -= pas), 'Caissier(ère)', paiement.caissier.nom)

  // Encadré montants.
  page.drawRectangle({ x: 40, y: 118, width: 350, height: 74, color: GRIS_CLAIR })
  page.drawText('Montant payé', { x: 56, y: 168, size: 10, font: police, color: GRIS })
  page.drawText(montantFCFA(paiement.montant), {
    x: 56,
    y: 146,
    size: 17,
    font: policeGras,
    color: VERT
  })
  page.drawText(`Total dû : ${montantFCFA(paiement.inscription.montantTotal)}`, {
    x: 56,
    y: 128,
    size: 8.5,
    font: police,
    color: GRIS
  })
  page.drawText(`Cumul payé : ${montantFCFA(cumul)}`, {
    x: 230,
    y: 168,
    size: 9,
    font: police,
    color: GRIS
  })
  page.drawText('Reste à payer', { x: 230, y: 152, size: 9, font: police, color: GRIS })
  page.drawText(montantFCFA(reste), {
    x: 230,
    y: 134,
    size: 13,
    font: policeGras,
    color: reste > 0 ? rgb(0.71, 0.4, 0.11) : VERT
  })

  // QR code de vérification (numéro, matricule, montant, date).
  const contenuQr = `MIENRA|${paiement.numeroRecu}|${eleve.matricule}|${paiement.montant}|${paiement.datePaiement.toISOString().slice(0, 10)}`
  const qrPng = await QRCode.toBuffer(contenuQr, { margin: 0, width: 220 })
  const qrImage = await pdf.embedPng(qrPng)
  page.drawImage(qrImage, { x: 470, y: 118, width: 74, height: 74 })
  page.drawText('Vérification', { x: 480, y: 106, size: 7.5, font: police, color: GRIS })

  // Pied : signature + mention.
  page.drawLine({ start: { x: 40, y: 62 }, end: { x: 200, y: 62 }, thickness: 0.8, color: GRIS })
  page.drawText('Signature et cachet', { x: 40, y: 50, size: 8.5, font: police, color: GRIS })
  page.drawText(
    'Reçu généré par MIENRA : logiciel de gestion scolaire. Merci de conserver ce document.',
    { x: 40, y: 24, size: 7.5, font: police, color: GRIS }
  )

  // ------------------------------------------------------------- écriture
  fs.mkdirSync(dossierSortie, { recursive: true })
  const chemin = path.join(dossierSortie, `${paiement.numeroRecu}.pdf`)
  fs.writeFileSync(chemin, await pdf.save())
  return chemin
}
