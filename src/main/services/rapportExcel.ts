/**
 * Export Excel des rapports (ExcelJS) : titre, sous-titre, tableau avec
 * en-têtes stylés, montants au format monétaire FCFA et ligne de totaux.
 */
import ExcelJS from 'exceljs'
import type { PrismaClient } from '@prisma/client'
import { MODE_PAIEMENT_LABELS, type RapportData } from '@shared/types'

const FORMAT_FCFA = '# ##0" FCFA"'
const BLEU = 'FF1B345C' // primary-800 (ARGB)
const BLANC = 'FFFFFFFF'

export async function genererRapportExcel(
  prisma: PrismaClient,
  data: RapportData,
  chemin: string
): Promise<void> {
  const ecole = await prisma.parametresEcole.findFirst()
  const classeur = new ExcelJS.Workbook()
  classeur.creator = 'MIENRA'
  const feuille = classeur.addWorksheet(data.titre.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: 'portrait' } // A4
  })

  const nbColonnes = 6

  // ----------------------------------------------------------- en-tête
  feuille.mergeCells(1, 1, 1, nbColonnes)
  const titreEcole = feuille.getCell(1, 1)
  const coordonnees = [ecole?.adresse, ecole?.telephone, ecole?.email].filter(Boolean).join(' : ')
  titreEcole.value = `${ecole?.nom ?? 'MIENRA'}${coordonnees ? ` : ${coordonnees}` : ''}`
  titreEcole.font = { bold: true, size: 14, color: { argb: BLANC } }
  titreEcole.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLEU } }
  titreEcole.alignment = { vertical: 'middle' }
  feuille.getRow(1).height = 24

  feuille.mergeCells(2, 1, 2, nbColonnes)
  feuille.getCell(2, 1).value = data.titre
  feuille.getCell(2, 1).font = { bold: true, size: 12 }

  feuille.mergeCells(3, 1, 3, nbColonnes)
  feuille.getCell(3, 1).value =
    `${data.sousTitre} : généré le ${new Date(data.genereLe).toLocaleDateString('fr-FR')}`
  feuille.getCell(3, 1).font = { size: 10, color: { argb: 'FF6B7280' } }

  // ------------------------------------------------------------ tableau
  const ligneEntete = 5
  const entetes =
    data.famille === 'PAIEMENTS'
      ? ['N° reçu', 'Date', 'Élève', 'Classe', 'Mode', 'Montant']
      : ['Élève', 'Matricule', 'Classe', 'Attendu', 'Payé', 'Reste', '% payé']
  entetes.forEach((titre, i) => {
    const cellule = feuille.getCell(ligneEntete, i + 1)
    cellule.value = titre
    cellule.font = { bold: true, color: { argb: BLANC } }
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLEU } }
  })

  if (data.famille === 'PAIEMENTS') {
    feuille.columns = [
      { width: 16 },
      { width: 12 },
      { width: 28 },
      { width: 16 },
      { width: 14 },
      { width: 16 }
    ]
    data.lignes.forEach((l, i) => {
      const ligne = feuille.getRow(ligneEntete + 1 + i)
      ligne.getCell(1).value = l.numeroRecu
      ligne.getCell(2).value = new Date(l.date).toLocaleDateString('fr-FR')
      ligne.getCell(3).value = `${l.nomComplet} (${l.matricule})`
      ligne.getCell(4).value = l.classe
      ligne.getCell(5).value = MODE_PAIEMENT_LABELS[l.mode]
      ligne.getCell(6).value = l.montant
      ligne.getCell(6).numFmt = FORMAT_FCFA
    })

    // Totaux : global puis répartition par mode.
    let y = ligneEntete + data.lignes.length + 2
    feuille.getCell(y, 5).value = 'TOTAL ENCAISSÉ'
    feuille.getCell(y, 5).font = { bold: true }
    feuille.getCell(y, 6).value = data.totaux.montant
    feuille.getCell(y, 6).numFmt = FORMAT_FCFA
    feuille.getCell(y, 6).font = { bold: true }
    feuille.getCell(y, 1).value = `Nombre de paiements : ${data.totaux.nombre}`
    for (const m of data.totaux.parMode) {
      y++
      feuille.getCell(y, 5).value = MODE_PAIEMENT_LABELS[m.mode]
      feuille.getCell(y, 6).value = m.montant
      feuille.getCell(y, 6).numFmt = FORMAT_FCFA
    }
  } else {
    feuille.columns = [
      { width: 28 },
      { width: 18 },
      { width: 16 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 9 }
    ]
    data.lignes.forEach((l, i) => {
      const ligne = feuille.getRow(ligneEntete + 1 + i)
      ligne.getCell(1).value = l.nomComplet
      ligne.getCell(2).value = l.matricule
      ligne.getCell(3).value = l.classe
      ligne.getCell(4).value = l.montantAttendu
      ligne.getCell(5).value = l.montantPaye
      ligne.getCell(6).value = l.reste
      ligne.getCell(7).value = l.pourcentagePaye / 100
      ligne.getCell(7).numFmt = '0 %'
      for (const c of [4, 5, 6]) ligne.getCell(c).numFmt = FORMAT_FCFA
    })

    const y = ligneEntete + data.lignes.length + 2
    feuille.getCell(y, 1).value = `Élèves en impayés : ${data.totaux.nombre}`
    feuille.getCell(y, 3).value = 'TOTAUX'
    feuille.getCell(y, 3).font = { bold: true }
    feuille.getCell(y, 4).value = data.totaux.montantAttendu
    feuille.getCell(y, 5).value = data.totaux.montantPaye
    feuille.getCell(y, 6).value = data.totaux.reste
    for (const c of [4, 5, 6]) {
      feuille.getCell(y, c).numFmt = FORMAT_FCFA
      feuille.getCell(y, c).font = { bold: true }
    }
  }

  await classeur.xlsx.writeFile(chemin)
}
