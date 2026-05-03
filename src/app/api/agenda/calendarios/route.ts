import { apiHandler, requireAuth } from "@/lib/api";
import { listCalendars } from "@/lib/google-calendar";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return listCalendars();
  });
}
