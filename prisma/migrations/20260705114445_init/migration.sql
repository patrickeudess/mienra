-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "identifiant" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnneeScolaire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libelle" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Eleve" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "dateNaissance" DATETIME NOT NULL,
    "lieuNaissance" TEXT NOT NULL,
    "nationalite" TEXT NOT NULL,
    "telephoneParent" TEXT NOT NULL,
    "nomParent" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "photo" TEXT,
    "creeLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eleveId" INTEGER NOT NULL,
    "classeId" INTEGER NOT NULL,
    "anneeScolaireId" INTEGER NOT NULL,
    "scolarite" INTEGER NOT NULL,
    "fraisInscription" INTEGER NOT NULL,
    "autresFrais" INTEGER NOT NULL DEFAULT 0,
    "montantTotal" INTEGER NOT NULL,
    "dateInscription" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inscription_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inscription_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inscription_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inscriptionId" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "numeroRecu" TEXT NOT NULL,
    "caissierId" INTEGER NOT NULL,
    "datePaiement" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Paiement_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Paiement_caissierId_fkey" FOREIGN KEY ("caissierId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalActivite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "utilisateurId" INTEGER,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "poste" TEXT NOT NULL DEFAULT '',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalActivite_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_identifiant_key" ON "Utilisateur"("identifiant");

-- CreateIndex
CREATE UNIQUE INDEX "AnneeScolaire_libelle_key" ON "AnneeScolaire"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_nom_key" ON "Classe"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_matricule_key" ON "Eleve"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_eleveId_anneeScolaireId_key" ON "Inscription"("eleveId", "anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_numeroRecu_key" ON "Paiement"("numeroRecu");
