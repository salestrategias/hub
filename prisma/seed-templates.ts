/**
 * Standalone runner pra rodar o seed de templates built-in.
 *
 * Uso:
 *   npx tsx prisma/seed-templates.ts
 *
 * Reusa a definição de built-ins em `src/lib/templates-builtin.ts`.
 */
import { PrismaClient } from "@prisma/client";
import { seedTemplates } from "../src/lib/templates-builtin";

const prisma = new PrismaClient();

seedTemplates(prisma)
  .catch((e) => {
    console.error("❌ Falha no seed de templates:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
