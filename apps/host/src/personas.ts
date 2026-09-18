import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PERSONAS, type PersonaId } from "@anvil/pi-ext-delegate";
import { anvilHome } from "./config.ts";

export type PersonaSpec = { label: string; tools: string[]; system: string };

export function personasDir(): string {
  return join(anvilHome(), "personas");
}

export function defaultPersonas(): Record<PersonaId, PersonaSpec> {
  return {
    architect: { ...PERSONAS.architect },
    implementer: { ...PERSONAS.implementer },
    reviewer: { ...PERSONAS.reviewer },
  };
}

export async function ensurePersonas(): Promise<Record<PersonaId, PersonaSpec>> {
  const dir = personasDir();
  await mkdir(dir, { recursive: true });
  const defaults = defaultPersonas();
  for (const id of Object.keys(defaults) as PersonaId[]) {
    const file = join(dir, `${id}.md`);
    try {
      await access(file);
    } catch {
      await writeFile(file, renderPersonaMarkdown(id, defaults[id]), "utf8");
    }
  }
  return loadPersonas();
}

export async function loadPersonas(): Promise<Record<PersonaId, PersonaSpec>> {
  const loaded = defaultPersonas();
  for (const id of Object.keys(loaded) as PersonaId[]) {
    try {
      const raw = await readFile(join(personasDir(), `${id}.md`), "utf8");
      const parsed = parsePersonaMarkdown(raw);
      if (parsed) {
        loaded[id] = parsed;
      }
    } catch {
      /* keep built-in default */
    }
  }
  return loaded;
}

export function renderPersonaMarkdown(id: PersonaId, spec: PersonaSpec): string {
  return [
    "---",
    `id: ${id}`,
    `label: ${spec.label}`,
    `tools: ${spec.tools.join(", ")}`,
    "---",
    "",
    spec.system.trim(),
    "",
  ].join("\n");
}

export function parsePersonaMarkdown(raw: string): PersonaSpec | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return null;
  }
  const header = match[1] ?? "";
  const body = (match[2] ?? "").trim();
  const fields: Record<string, string> = {};
  for (const line of header.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const label = fields.label?.trim();
  const tools = (fields.tools ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!label || tools.length === 0 || !body) {
    return null;
  }
  return { label, tools, system: body };
}
