import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const PRISMA_CLIENT_SCHEMA_VERSION = "2026-06-02-mobile-team-default-season-v1";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

const adapter = new PrismaPg({ connectionString });
const shouldReusePrisma =
  globalForPrisma.prisma && globalForPrisma.prismaSchemaVersion === PRISMA_CLIENT_SCHEMA_VERSION;

if (globalForPrisma.prisma && !shouldReusePrisma) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
}

export const prisma =
  shouldReusePrisma && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
        adapter,
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = PRISMA_CLIENT_SCHEMA_VERSION;
}
