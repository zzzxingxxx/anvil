import { homedir } from "node:os";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";

async function collect(dir, acc, limit) {
  if (acc.length >= limit) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (acc.length >= limit) return;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(full, acc, limit);
    } else if (entry.name.endsWith(".jsonl")) {
      acc.push(full);
    }
  }
}

const files = [];
await collect(join(homedir(), ".pi", "agent", "sessions"), files, 5);
if (files.length === 0) {
  console.log("no local pi sessions");
  process.exit(0);
}
for (const file of files) {
  const opened = SessionManager.open(file);
  const header = opened.getHeader();
  console.log(
    JSON.stringify({
      file: file.replace(/\\/g, "/").split("/").pop(),
      version: header?.version ?? null,
      entries: opened.getEntries().length,
      ok: header?.type === "session",
    }),
  );
}
