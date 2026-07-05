-- CreateTable
CREATE TABLE "ParametresEcole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nom" TEXT NOT NULL DEFAULT 'Mon École',
    "adresse" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "logo" TEXT
);
