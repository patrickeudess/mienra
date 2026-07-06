/**
 * Export PDF des rapports (pdf-lib) — A4 portrait, multi-pages.
 * En-tête de l'école sur la première page, tableau avec en-têtes répétés,
 * bloc de totaux en fin de rapport, numérotation des pages.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import fs from 'fs'
import type { PrismaClient } from '@prisma/client'
import { MODE_PAIEMENT_LABELS, type RapportData } from '@shared/types'

const LARGEUR = 595
const HAUTEUR = 842
const MARGE = 40

const BLEU = rgb(0.082, 0.161, 0.278)
const VERT = rgb(0.141, 0.482, 0.31)
const AMBRE = rgb(0.71, 0.4, 0.11)
const GRIS = rgb(0.42, 0.45, 0.5)
const GRIS_CLAIR = rgb(0.93, 0.94, 0.95)
const BLANC = rgb(1, 1, 1)

/** Montant en FCFA avec espaces simples (compatibles polices standard). */
function montantFCFA(n: number): string {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`
}

interface Colonne {
  titre: string
  largeur: number
  alignement?: 'gauche' | 'droite'
}

/** Colonnes du tableau selon la famille de rapport. */
function colonnes(data: RapportData): Colonne[] {
  if (data.famille === 'PAIEMENTS') {
    return [
      { titre: 'N° reçu', largeur: 88 },
      { titre: 'Date', largeur: 60 },
      { titre: 'Élève', largeur: 137 },
      { titre: 'Classe', largeur: 80 },
      { titre: 'Mode', largeur: 75 },
      { titre: 'Montant', largeur: 75, alignement: 'droite' }
    ]
  }
  return [
    { titre: 'Élève', largeur: 155 },
    { titre: 'Classe', largeur: 80 },
    { titre: 'Attendu', largeur: 75, alignement: 'droite' },
    { titre: 'Payé', largeur: 75, alignement: 'droite' },
    { titre: 'Reste', largeur: 75, alignement: 'droite' },
    { titre: '% payé', largeur: 55, alignement: 'droite' }
  ]
}

/** Cellules d'une ligne selon la famille de rapport. */
function cellules(data: RapportData, index: number): string[] {
  if (data.famille === 'PAIEMENTS') {
    const l = data.lignes[index]
    return [
      l.numeroRecu,
      new Date(l.date).toLocaleDateString('fr-FR'),
      `${l.nomComplet} (${l.matricule.split('-').pop()})`,
      l.classe,
      MODE_PAIEMENT_LABELS[l.mode],
      montantFCFA(l.montant)
    ]
  }
  const l = data.lignes[index]
  return [
    `${l.nomComplet} (${l.matricule.split('-').pop()})`,
    l.classe,
    montantFCFA(l.montantAttendu),
    montantFCFA(l.montantPaye),
    montantFCFA(l.reste),
    `${l.pourcentagePaye} %`
  ]
}

export async function genererRapportPdf(
  prisma: PrismaClient,
  data: RapportData,
  chemin: string
): Promise<void> {
  const ecole = await prisma.parametresEcole.findFirst()
  const pdf = await PDFDocument.create()
  const police = await pdf.embedFont(StandardFonts.Helvetica)
  const policeGras = await pdf.embedFont(StandardFonts.HelveticaBold)

  const cols = colonnes(data)
  const pages: PDFPage[] = []
  let page = pdf.addPage([LARGEUR, HAUTEUR])
  pages.push(page)
  let y = HAUTEUR - MARGE

  // ------------------------------------------------- en-tête (1re page)
  page.drawRectangle({ x: 0, y: HAUTEUR - 70, width: LARGEUR, height: 70, color: BLEU })
  page.drawText(ecole?.nom ?? 'MIENRA', {
    x: MARGE,
    y: HAUTEUR - 38,
    size: 15,
    font: policeGras,
    color: BLANC
  })
  const sousEcole = [ecole?.adresse, ecole?.telephone, ecole?.email].filter(Boolean).join('  :  ')
  if (sousEcole) {
    page.drawText(sousEcole, {
      x: MARGE,
      y: HAUTEUR - 55,
      size: 8.5,
      font: police,
      color: rgb(0.8, 0.85, 0.92)
    })
  }
  y = HAUTEUR - 100
  page.drawText(data.titre, { x: MARGE, y, size: 16, font: policeGras, color: BLEU })
  y -= 18
  page.drawText(data.sousTitre, { x: MARGE, y, size: 10, font: police, color: GRIS })
  page.drawText(`Généré le ${new Date(data.genereLe).toLocaleDateString('fr-FR')}`, {
    x: LARGEUR - MARGE - 110,
    y,
    size: 8.5,
    font: police,
    color: GRIS
  })
  y -= 24

  // --------------------------------------------------------- tableau
  const hauteurLigne = 20

  const dessinerEnteteTableau = (p: PDFPage, yTete: number): number => {
    p.drawRectangle({
      x: MARGE,
      y: yTete - 15,
      width: LARGEUR - 2 * MARGE,
      height: 20,
      color: BLEU
    })
    let x = MARGE + 8
    for (const col of cols) {
      const texte = col.titre
      const xTexte =
        col.alignement === 'droite'
          ? x + col.largeur - 16 - policeGras.widthOfTextAtSize(texte, 8.5)
          : x
      p.drawText(texte, { x: xTexte, y: yTete - 9, size: 8.5, font: policeGras, color: BLANC })
      x += col.largeur
    }
    return yTete - 15 - hauteurLigne
  }

  y = dessinerEnteteTableau(page, y)

  if (data.lignes.length === 0) {
    page.drawText('Aucune donnée pour les critères choisis.', {
      x: MARGE + 8,
      y,
      size: 10,
      font: police,
      color: GRIS
    })
    y -= hauteurLigne
  }

  for (let i = 0; i < data.lignes.length; i++) {
    // Saut de page si nécessaire (place pour la ligne + le pied de page).
    if (y < MARGE + 30) {
      page = pdf.addPage([LARGEUR, HAUTEUR])
      pages.push(page)
      y = dessinerEnteteTableau(page, HAUTEUR - MARGE)
    }
    if (i % 2 === 1) {
      page.drawRectangle({
        x: MARGE,
        y: y - 6,
        width: LARGEUR - 2 * MARGE,
        height: hauteurLigne,
        color: GRIS_CLAIR
      })
    }
    let x = MARGE + 8
    const valeurs = cellules(data, i)
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c]
      let texte = valeurs[c]
      // Tronque les textes trop longs pour la colonne.
      while (police.widthOfTextAtSize(texte, 8.5) > col.largeur - 14 && texte.length > 3) {
        texte = `${texte.slice(0, -2)}…`.replace('……', '…')
      }
      const xTexte =
        col.alignement === 'droite'
          ? x + col.largeur - 16 - police.widthOfTextAtSize(texte, 8.5)
          : x
      page.drawText(texte, { x: xTexte, y, size: 8.5, font: police, color: rgb(0.15, 0.17, 0.2) })
      x += col.largeur
    }
    y -= hauteurLigne
  }

  // ---------------------------------------------------------- totaux
  const hauteurTotaux = data.famille === 'PAIEMENTS' ? 60 + data.totaux.parMode.length * 14 : 74
  if (y < MARGE + hauteurTotaux) {
    page = pdf.addPage([LARGEUR, HAUTEUR])
    pages.push(page)
    y = HAUTEUR - MARGE
  }
  y -= 8
  page.drawRectangle({
    x: MARGE,
    y: y - hauteurTotaux + 14,
    width: LARGEUR - 2 * MARGE,
    height: hauteurTotaux,
    color: GRIS_CLAIR
  })
  if (data.famille === 'PAIEMENTS') {
    page.drawText(`Nombre de paiements : ${data.totaux.nombre}`, {
      x: MARGE + 12,
      y: y - 6,
      size: 9.5,
      font: police,
      color: GRIS
    })
    page.drawText(`TOTAL ENCAISSÉ : ${montantFCFA(data.totaux.montant)}`, {
      x: MARGE + 12,
      y: y - 26,
      size: 13,
      font: policeGras,
      color: VERT
    })
    let yMode = y - 6
    for (const m of data.totaux.parMode) {
      page.drawText(`${MODE_PAIEMENT_LABELS[m.mode]} : ${montantFCFA(m.montant)}`, {
        x: MARGE + 300,
        y: yMode,
        size: 9,
        font: police,
        color: rgb(0.15, 0.17, 0.2)
      })
      yMode -= 14
    }
  } else {
    page.drawText(`Élèves en impayés : ${data.totaux.nombre}`, {
      x: MARGE + 12,
      y: y - 6,
      size: 9.5,
      font: police,
      color: GRIS
    })
    page.drawText(`RESTE À RECOUVRER : ${montantFCFA(data.totaux.reste)}`, {
      x: MARGE + 12,
      y: y - 26,
      size: 13,
      font: policeGras,
      color: AMBRE
    })
    page.drawText(`Attendu : ${montantFCFA(data.totaux.montantAttendu)}`, {
      x: MARGE + 300,
      y: y - 6,
      size: 9,
      font: police,
      color: rgb(0.15, 0.17, 0.2)
    })
    page.drawText(`Payé : ${montantFCFA(data.totaux.montantPaye)}`, {
      x: MARGE + 300,
      y: y - 20,
      size: 9,
      font: police,
      color: rgb(0.15, 0.17, 0.2)
    })
  }

  // ------------------------------------------------ pieds de page
  pages.forEach((p, i) => {
    p.drawText(`MIENRA : ${data.titre}, page ${i + 1} / ${pages.length}`, {
      x: MARGE,
      y: 20,
      size: 7.5,
      font: police,
      color: GRIS
    })
  })

  fs.writeFileSync(chemin, await pdf.save())
}
