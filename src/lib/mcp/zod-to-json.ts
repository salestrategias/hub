import { z } from "zod";

/**
 * Conversor minimalista de Zod schema para JSON Schema (Draft 7).
 * Cobre os tipos que usamos: object, string, number, boolean, array, enum, optional, nullable.
 * Para casos avançados (uniões complexas, refines), use uma lib como zod-to-json-schema.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const def = (schema as unknown as { _def: { typeName: string; [k: string]: unknown } })._def;
  switch (def.typeName) {
    case "ZodString": {
      const checks = (def as { checks?: { kind: string; value?: unknown }[] }).checks ?? [];
      const out: Record<string, unknown> = { type: "string" };
      for (const c of checks) {
        if (c.kind === "min" && typeof c.value === "number") out.minLength = c.value;
        if (c.kind === "max" && typeof c.value === "number") out.maxLength = c.value;
        if (c.kind === "email") out.format = "email";
        if (c.kind === "url") out.format = "uri";
        if (c.kind === "uuid") out.format = "uuid";
      }
      return out;
    }
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodDate":
      return { type: "string", format: "date-time" };
    case "ZodLiteral":
      return { const: (def as { value: unknown }).value };
    case "ZodEnum":
      return { type: "string", enum: (def as { values: string[] }).values };
    case "ZodNativeEnum":
      return { type: "string", enum: Object.values((def as { values: Record<string, string> }).values) };
    case "ZodArray":
      return {
        type: "array",
        items: zodToJsonSchema((def as { type: z.ZodType }).type),
      };
    case "ZodObject": {
      const shape = (def as { shape: () => Record<string, z.ZodType> }).shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodToJsonSchema(v);
        const inner = (v as unknown as { _def: { typeName: string } })._def.typeName;
        if (inner !== "ZodOptional" && inner !== "ZodDefault" && inner !== "ZodNullable") {
          required.push(k);
        }
      }
      return { type: "object", properties, ...(required.length ? { required } : {}) };
    }
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
      return zodToJsonSchema((def as { innerType: z.ZodType }).innerType);
    case "ZodEffects":
      return zodToJsonSchema((def as { schema: z.ZodType }).schema);
    case "ZodUnion": {
      const opts = (def as { options: z.ZodType[] }).options;
      return { anyOf: opts.map(zodToJsonSchema) };
    }
    case "ZodAny":
    case "ZodUnknown":
    default:
      return {};
  }
}
