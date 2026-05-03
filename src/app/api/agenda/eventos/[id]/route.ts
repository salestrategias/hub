import { apiHandler, requireAuth } from "@/lib/api";
import { updateEvent, deleteEvent } from "@/lib/google-calendar";
import { eventoSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = eventoSchema.partial().parse(await req.json());
    return updateEvent({ eventId: params.id, ...data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await deleteEvent({ eventId: params.id });
    return { ok: true };
  });
}
