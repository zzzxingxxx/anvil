import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { TrustLevel } from "@anvil/protocol";

export type AnvilConfig = {
  recentWorkspaces: string[];
  trustedWorkspaces: string[];
};

const EMPTY: AnvilConfig = { recentWorkspaces: [], trustedWorkspaces: [] };

export function anvilHome(): string {
  return process.env.ANVIL_HOME?.trim() || join(homedir(), ".anvil");
}

export function configPath(): string {
  return join(anvilHome(), "config.json");
}

export async function loadConfig(): Promise<AnvilConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AnvilConfig>;
    return {
      recentWorkspaces: Array.isArray(parsed.recentWorkspaces)
        ? parsed.recentWorkspaces.filter((item): item is string => typeof item === "string")
        : [],
      trustedWorkspaces: Array.isArray(parsed.trustedWorkspaces)
        ? parsed.trustedWorkspaces.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return { ...EMPTY, recentWorkspaces: [], trustedWorkspaces: [] };
  }
}

export async function saveConfig(config: AnvilConfig): Promise<void> {
  await mkdir(anvilHome(), { recursive: true });
  await writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function rememberWorkspace(config: AnvilConfig, path: string, trust: TrustLevel): AnvilConfig {
  const recentWorkspaces = [path, ...config.recentWorkspaces.filter((item) => item !== path)].slice(0, 8);
  const trusted = new Set(config.trustedWorkspaces);
  if (trust === "trusted") {
    trusted.add(path);
  } else {
    trusted.delete(path);
  }
  return { recentWorkspaces, trustedWorkspaces: [...trusted] };
}

export function trustFor(config: AnvilConfig, path: string): TrustLevel {
  return config.trustedWorkspaces.includes(path) ? "trusted" : "untrusted";
}

export function useFakePi(): boolean {
  const value = process.env.ANVIL_FAKE_PI;
  if (value === "0" || value === "false") {
    return false;
  }
  if (value === "1" || value === "true") {
    return true;
  }
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}
