import { apiHandler, requireAuth } from "@/lib/api";
import { listEvents, createEvent } from "@/lib/google-calendar";
import { eventoSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get("calendarId") ?? undefined;
    const timeMin = searchParams.get("timeMin");
    const timeMax = searchParams.get("timeMax");
    return listEvents({
      calendarId,
      timeMin: timeMin ? new Date(timeMin) : undefined,
      timeMax: timeMax ? new Date(timeMax) : undefined,
      maxResults: 250,
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = eventoSchema.parse(await req.json());
    return createEvent(data);
  });
}
