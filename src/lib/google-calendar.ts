import { google, type calendar_v3 } from "googleapis";
import { getGoogleClient } from "@/lib/google-auth";

export type AgendaEvento = {
  id: string;
  titulo: string;
  descricao?: string | null;
  inicio: string; // ISO
  fim: string;    // ISO
  htmlLink?: string | null;
};

export async function calendarClient() {
  const auth = await getGoogleClient();
  return google.calendar({ version: "v3", auth });
}

export async function listEvents(opts: {
  calendarId?: string;
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
}): Promise<AgendaEvento[]> {
  const cal = await calendarClient();
  const res = await cal.events.list({
    calendarId: opts.calendarId ?? "primary",
    timeMin: (opts.timeMin ?? new Date()).toISOString(),
    timeMax: opts.timeMax?.toISOString(),
    maxResults: opts.maxResults ?? 250,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map(toEvento);
}

export async function listCalendars() {
  const cal = await calendarClient();
  const res = await cal.calendarList.list();
  return (res.data.items ?? []).map((c) => ({
    id: c.id ?? "",
    summary: c.summary ?? "(sem nome)",
    primary: !!c.primary,
    backgroundColor: c.backgroundColor ?? null,
  }));
}

export async function createEvent(input: {
  calendarId?: string;
  titulo: string;
  descricao?: string;
  inicio: Date;
  fim: Date;
}): Promise<AgendaEvento> {
  const cal = await calendarClient();
  const res = await cal.events.insert({
    calendarId: input.calendarId ?? "primary",
    requestBody: {
      summary: input.titulo,
      description: input.descricao,
      start: { dateTime: input.inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: input.fim.toISOString(), timeZone: "America/Sao_Paulo" },
    },
  });
  return toEvento(res.data);
}

export async function updateEvent(input: {
  calendarId?: string;
  eventId: string;
  titulo?: string;
  descricao?: string;
  inicio?: Date;
  fim?: Date;
}): Promise<AgendaEvento> {
  const cal = await calendarClient();
  const res = await cal.events.patch({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
    requestBody: {
      summary: input.titulo,
      description: input.descricao,
      start: input.inicio
        ? { dateTime: input.inicio.toISOString(), timeZone: "America/Sao_Paulo" }
        : undefined,
      end: input.fim
        ? { dateTime: input.fim.toISOString(), timeZone: "America/Sao_Paulo" }
        : undefined,
    },
  });
  return toEvento(res.data);
}

export async function deleteEvent(opts: { calendarId?: string; eventId: string }) {
  const cal = await calendarClient();
  await cal.events.delete({
    calendarId: opts.calendarId ?? "primary",
    eventId: opts.eventId,
  });
}

function toEvento(e: calendar_v3.Schema$Event): AgendaEvento {
  return {
    id: e.id ?? "",
    titulo: e.summary ?? "(sem título)",
    descricao: e.description ?? null,
    inicio: e.start?.dateTime ?? e.start?.date ?? "",
    fim: e.end?.dateTime ?? e.end?.date ?? "",
    htmlLink: e.htmlLink ?? null,
  };
}

/** Wrappers seguros — não lançam erro se Google não estiver conectado */
export async function tryCreateEvent(input: Parameters<typeof createEvent>[0]): Promise<AgendaEvento | null> {
  try { return await createEvent(input); } catch { return null; }
}
export async function tryUpdateEvent(input: Parameters<typeof updateEvent>[0]): Promise<AgendaEvento | null> {
  try { return await updateEvent(input); } catch { return null; }
}
export async function tryDeleteEvent(opts: Parameters<typeof deleteEvent>[0]): Promise<boolean> {
  try { await deleteEvent(opts); return true; } catch { return false; }
}
