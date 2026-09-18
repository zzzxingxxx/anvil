import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ModelInfo } from "@anvil/protocol";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type OpenAiModel = {
  id: string;
  name?: string;
};

export type PiModelsFile = {
  providers: Record<string, PiProviderConfig>;
};

export type PiProviderConfig = {
  api?: string;
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  models?: Array<{
    id: string;
    name?: string;
    reasoning?: boolean;
    contextWindow?: number;
    maxTokens?: number;
  }>;
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_MODELS = 80;

export function normalizeOpenAiBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("请填写完整的 http(s) 接口地址");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("接口地址只支持 http 或 https");
  }
  parsed.hash = "";
  parsed.search = "";
  let path = parsed.pathname.replace(/\/+$/, "");
  if (path.endsWith("/models")) {
    path = path.slice(0, -"/models".length);
  }
  if (path.endsWith("/chat/completions")) {
    path = path.slice(0, -"/chat/completions".length);
  }
  parsed.pathname = path || "/";
  return parsed.toString().replace(/\/+$/, "");
}

export function slugPart(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || fallback;
}

export function providerIdFromUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  const host = slugPart(parsed.hostname.replace(/^www\./, ""), "custom");
  const path = slugPart(parsed.pathname.replace(/^\/+|\/+$/g, ""), "");
  return path ? `${host}-${path}` : host;
}

export function uniqueProviderId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) {
    return base;
  }
  for (let i = 2; i < 100; i += 1) {
    const next = `${base}-${i}`;
    if (!existing.has(next)) {
      return next;
    }
  }
  return `${base}-${Date.now().toString(16).slice(-4)}`;
}

export function modelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/models`;
}

export async function fetchOpenAiModels(baseUrl: string, apiKey: string): Promise<OpenAiModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(modelsUrl(baseUrl), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("拉取模型超时");
    }
    throw new Error("无法连接模型接口");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("密钥无效或没有权限");
  }
  if (!response.ok) {
    throw new Error(`拉取模型失败（${response.status}）`);
  }
  const body = (await response.json()) as { data?: unknown; models?: unknown };
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
  const models: OpenAiModel[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const record = row as { id?: unknown; name?: unknown };
    if (typeof record.id !== "string" || !record.id.trim()) {
      continue;
    }
    models.push({
      id: record.id.trim(),
      name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : record.id.trim(),
    });
    if (models.length >= MAX_MODELS) {
      break;
    }
  }
  if (models.length === 0) {
    throw new Error("接口没有返回可用模型");
  }
  return models;
}

export async function upsertPiProvider(input: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  models: OpenAiModel[];
}): Promise<PiModelsFile> {
  const path = join(getAgentDir(), "models.json");
  const current = await readPiModels(path);
  current.providers[input.provider] = {
    api: "openai-completions",
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    headers: {},
    models: input.models.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      contextWindow: 128000,
      maxTokens: 8192,
    })),
  };
  await mkdir(dirname(path), { recursive: true });
  const raw = `${JSON.stringify(current, null, 2)}\n`;
  await writeFile(path, raw, { encoding: "utf8" });
  return current;
}

export async function importOpenAiModels(input: {
  url: string;
  apiKey: string;
  provider?: string;
}): Promise<{ provider: string; models: ModelInfo[]; endpoints: ModelEndpointSummary[] }> {
  const baseUrl = normalizeOpenAiBaseUrl(input.url);
  const file = await readPiModelsFile();
  const existing = new Set(Object.keys(file.providers));
  const requested = input.provider?.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  const sameUrl = Object.entries(file.providers).find(([, config]) => config.baseUrl === baseUrl)?.[0];
  const provider = requested || sameUrl || uniqueProviderId(providerIdFromUrl(baseUrl), existing);
  if (!provider) {
    throw new Error("provider 名称无效");
  }
  const fetched = await fetchOpenAiModels(baseUrl, input.apiKey.trim());
  const next = await upsertPiProvider({
    provider,
    baseUrl,
    apiKey: input.apiKey.trim(),
    models: fetched,
  });
  return {
    provider,
    models: fetched.map((model) => ({
      id: `${provider}/${model.id}`,
      label: model.name ?? model.id,
      provider,
    })),
    endpoints: listEndpoints(next),
  };
}

export type ModelEndpointSummary = {
  id: string;
  baseUrl: string;
  modelCount: number;
};

export async function listPiEndpoints(): Promise<ModelEndpointSummary[]> {
  return listEndpoints(await readPiModelsFile());
}

export async function removePiProvider(provider: string): Promise<ModelEndpointSummary[]> {
  const path = join(getAgentDir(), "models.json");
  const current = await readPiModels(path);
  if (!current.providers[provider]) {
    throw new Error("没有这个接口");
  }
  delete current.providers[provider];
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8" });
  return listEndpoints(current);
}

function listEndpoints(file: PiModelsFile): ModelEndpointSummary[] {
  return Object.entries(file.providers)
    .filter(([, config]) => Boolean(config.baseUrl) && Array.isArray(config.models) && config.models.length > 0)
    .map(([id, config]) => ({
      id,
      baseUrl: config.baseUrl ?? "",
      modelCount: config.models?.length ?? 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function readPiModelsFile(): Promise<PiModelsFile> {
  return readPiModels(join(getAgentDir(), "models.json"));
}

async function readPiModels(path: string): Promise<PiModelsFile> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<PiModelsFile>;
    const providers =
      parsed.providers && typeof parsed.providers === "object" && !Array.isArray(parsed.providers)
        ? parsed.providers
        : {};
    return { providers };
  } catch {
    return { providers: {} };
  }
}
