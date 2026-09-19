import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { TrustLevel } from "@anvil/protocol";

export type PersonaModels = {
  architect?: string;
  implementer?: string;
  reviewer?: string;
};

export type McpServerConfig = {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

export type AnvilSettings = {
  trustDefault?: "trusted" | "untrusted";
  bashPolicy?: "ask" | "allowlist";
  bashAllowlist?: string[];
  defaultModel?: string;
  personaModels?: PersonaModels;
  mcpServers?: McpServerConfig[];
};

export type AnvilConfig = {
  recentWorkspaces: string[];
  trustedWorkspaces: string[];
  settings: AnvilSettings;
};

const EMPTY: AnvilConfig = { recentWorkspaces: [], trustedWorkspaces: [], settings: {} };

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
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    };
  } catch {
    return { ...EMPTY, recentWorkspaces: [], trustedWorkspaces: [], settings: {} };
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
  return { recentWorkspaces, trustedWorkspaces: [...trusted], settings: config.settings ?? {} };
}

export function trustFor(config: AnvilConfig, path: string): TrustLevel {
  if (config.trustedWorkspaces.includes(path)) {
    return "trusted";
  }
  return config.settings?.trustDefault ?? "untrusted";
}

export function useRpcPi(trustDefault?: "trusted" | "untrusted"): boolean {
  const mode = process.env.ANVIL_PI_MODE?.trim().toLowerCase();
  if (mode === "sdk") {
    return false;
  }
  if (mode === "rpc") {
    return true;
  }
  if (mode === "auto") {
    return trustDefault !== "trusted";
  }
  return false;
}

export function projectSettingsPath(cwd: string): string {
  return join(cwd, ".anvil", "settings.json");
}

export function mergeSettings(base: AnvilSettings, overlay: AnvilSettings): AnvilSettings {
  return {
    ...base,
    ...overlay,
    bashAllowlist: overlay.bashAllowlist ?? base.bashAllowlist,
    personaModels: {
      ...(base.personaModels ?? {}),
      ...(overlay.personaModels ?? {}),
    },
    mcpServers: overlay.mcpServers ?? base.mcpServers,
  };
}

export function resolvePersonaModel(
  settings: AnvilSettings | undefined,
  persona: "architect" | "implementer" | "reviewer",
  fallback?: string | null,
): string | undefined {
  const chosen = settings?.personaModels?.[persona]?.trim();
  if (chosen) {
    return chosen;
  }
  const inherited = fallback?.trim() || settings?.defaultModel?.trim();
  return inherited || undefined;
}

export async function loadProjectSettings(cwd: string): Promise<AnvilSettings> {
  try {
    const raw = await readFile(projectSettingsPath(cwd), "utf8");
    const parsed = JSON.parse(raw) as AnvilSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveProjectSettings(cwd: string, settings: AnvilSettings): Promise<void> {
  await mkdir(join(cwd, ".anvil"), { recursive: true });
  await writeFile(projectSettingsPath(cwd), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export function chooseAdapterKind(trustDefault?: "trusted" | "untrusted"): "fake" | "sdk" | "rpc" {
  if (useFakePi()) {
    return "fake";
  }
  return useRpcPi(trustDefault) ? "rpc" : "sdk";
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
