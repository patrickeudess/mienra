-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ParametresEcole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nom" TEXT NOT NULL DEFAULT 'Mon École',
    "adresse" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT 'MIENRA',
    "logo" TEXT,
    "configuree" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_ParametresEcole" ("adresse", "id", "logo", "nom", "telephone") SELECT "adresse", "id", "logo", "nom", "telephone" FROM "ParametresEcole";
DROP TABLE "ParametresEcole";
ALTER TABLE "new_ParametresEcole" RENAME TO "ParametresEcole";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
