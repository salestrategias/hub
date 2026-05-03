import { apiHandler, requireAuth } from "@/lib/api";
import { listEvents } from "@/lib/google-calendar";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? 5);
    const eventos = await listEvents({ maxResults: limit });
    return eventos;
  });
}
