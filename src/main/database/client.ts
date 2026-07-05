/**
 * Client Prisma unique pour tout le processus principal.
 *
 * En développement : la base est prisma/dev.db (DATABASE_URL du fichier .env).
 * En production    : la base est stockée dans le dossier userData de la
 *                    machine (ex. C:\Users\<nom>\AppData\Roaming\MIENRA),
 *                    afin de survivre aux mises à jour de l'application.
 */
import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'

/** Chemin absolu du fichier SQLite utilisé par l'application. */
export function getDatabasePath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'mienra.db')
  }
  // En dev, on réutilise la base créée par `prisma migrate dev`.
  return path.resolve(process.cwd(), 'prisma', 'dev.db')
}

let prismaInstance: PrismaClient | null = null

/** Retourne le client Prisma (créé au premier appel). */
export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: { url: `file:${getDatabasePath()}` }
      }
    })
  }
  return prismaInstance
}

/** Ferme proprement la connexion (appelé à la fermeture de l'application). */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
}
