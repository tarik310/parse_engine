/**
 * lib/prisma.ts — Prisma Client singleton
 *
 * Stores a single PrismaClient instance on the global object so that
 * Next.js hot-reload in development doesn't create a new connection on
 * every module re-evaluation.
 *
 * Prisma 7 requires a driver adapter — we use @prisma/adapter-better-sqlite3
 * for Node.js environments (the official approach for SQLite + Prisma 7).
 */

import { PrismaClient, Prisma } from "@/lib/generated/prisma/client";
export { Prisma };
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
