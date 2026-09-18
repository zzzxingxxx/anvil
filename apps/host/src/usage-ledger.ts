import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Usage } from "@anvil/protocol";
import { anvilHome } from "./config.ts";

export type UsageDay = {
  day: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type Ledger = {
  days: Record<string, UsageDay>;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ledgerPath(): string {
  return join(anvilHome(), "usage.json");
}

async function loadLedger(): Promise<Ledger> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Ledger>;
    return { days: parsed.days && typeof parsed.days === "object" ? parsed.days : {} };
  } catch {
    return { days: {} };
  }
}

async function saveLedger(ledger: Ledger): Promise<void> {
  await mkdir(anvilHome(), { recursive: true });
  await writeFile(ledgerPath(), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

export async function recordUsage(delta: Usage): Promise<void> {
  if (process.env.VITEST === "true" && !process.env.ANVIL_HOME) {
    return;
  }
  const ledger = await loadLedger();
  const day = today();
  const current = ledger.days[day] ?? { day, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  current.inputTokens += delta.inputTokens ?? 0;
  current.outputTokens += delta.outputTokens ?? 0;
  current.costUsd += delta.costUsd ?? 0;
  ledger.days[day] = current;
  await saveLedger(ledger);
}

export async function exportUsage(sessionFile: string | null): Promise<{
  text: string;
  days: UsageDay[];
  sessionFile: string | null;
}> {
  const ledger = await loadLedger();
  const days = Object.values(ledger.days)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 14);
  const week = days.slice(0, 7);
  const input = week.reduce((sum, item) => sum + item.inputTokens, 0);
  const output = week.reduce((sum, item) => sum + item.outputTokens, 0);
  const usd = week.reduce((sum, item) => sum + item.costUsd, 0);
  const text = [
    "Anvil 用量摘要（本地，未上传）",
    `days: ${week.map((item) => item.day).join(", ") || today()}`,
    `input: ${input}`,
    `output: ${output}`,
    `usd: ${usd.toFixed(4)}`,
    `session: ${sessionFile ?? "-"}`,
  ].join("\n");
  return { text, days, sessionFile };
}
