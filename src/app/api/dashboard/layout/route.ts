/**
 * GET/PUT /api/dashboard/layout
 *
 * Salva/lê o layout customizado do dashboard pro usuário autenticado.
 * Layout = ordem + visibilidade dos widgets. Default no codigo se null.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizarLayout, type Layout } from "@/lib/dashboard-widgets";

const layoutSchema = z.object({
  widgets: z
    .array(
      z.object({
        id: z.string(),
        visivel: z.boolean(),
      })
    )
    .min(1)
    .max(50),
});

export async function GET() {
  return apiHandler(async () => {
    const user = await requireAuth();
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { dashboardLayout: true },
    });
    return normalizarLayout(u.dashboardLayout);
  });
}

export async function PUT(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = layoutSchema.parse(await req.json());
    const layout = normalizarLayout(body) satisfies Layout;
    await prisma.user.update({
      where: { id: user.id },
      data: { dashboardLayout: layout },
    });
    return { ok: true, layout };
  });
}
