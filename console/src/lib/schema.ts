import type { JsonSchemaProperty, ToolSchema } from "./types";

export type FormValues = Record<string, string>;

export interface FieldSpec {
  name: string;
  kind: "integer" | "number" | "string" | "boolean" | "enum";
  required: boolean;
  description?: string;
  min?: number;
  max?: number;
  options?: (string | number)[];
}

const SAFE_MAX = Number.MAX_SAFE_INTEGER;

function kindOf(p: JsonSchemaProperty): FieldSpec["kind"] {
  if (p.enum) return "enum";
  const t = Array.isArray(p.type) ? p.type.find((x) => x !== "null") : p.type;
  if (t === "integer" || t === "number" || t === "boolean") return t;
  return "string";
}

/** Reads a tool's JSON Schema into form fields. Integer exclusive bounds become inclusive ones. */
export function fieldsFromSchema(schema: ToolSchema): FieldSpec[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, p]) => {
    const kind = kindOf(p);
    const step = kind === "integer" ? 1 : 0;
    let min = p.minimum;
    if (p.exclusiveMinimum !== undefined) min = p.exclusiveMinimum + step;
    let max = p.maximum;
    if (p.exclusiveMaximum !== undefined) max = p.exclusiveMaximum - step;
    if (max !== undefined && max >= SAFE_MAX) max = undefined;
    return { name, kind, required: required.has(name), description: p.description, min, max, options: p.enum };
  });
}

/**
 * Turns form strings into tool arguments. Empty optional fields are omitted, so the
 * server applies its own default. Values are sent as typed by the user: the MCP server
 * does the real validation, which is exactly what the console wants to show.
 */
export function buildArguments(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = (values[f.name] ?? "").trim();
    if (raw === "") continue;
    if (f.kind === "integer" || f.kind === "number") {
      const n = Number(raw);
      args[f.name] = Number.isNaN(n) ? raw : n;
    } else if (f.kind === "boolean") {
      args[f.name] = raw === "true";
    } else if (f.kind === "enum" && typeof f.options?.[0] === "number") {
      args[f.name] = Number(raw);
    } else {
      args[f.name] = raw;
    }
  }
  return args;
}

/** Client-side hint only; the call is still sent so the server's own rejection can be seen. */
export function fieldIssue(f: FieldSpec, raw: string): "required" | "nan" | "integer" | "min" | "max" | null {
  const v = raw.trim();
  if (v === "") return f.required ? "required" : null;
  if (f.kind !== "integer" && f.kind !== "number") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return "nan";
  if (f.kind === "integer" && !Number.isInteger(n)) return "integer";
  if (f.min !== undefined && n < f.min) return "min";
  if (f.max !== undefined && n > f.max) return "max";
  return null;
}
