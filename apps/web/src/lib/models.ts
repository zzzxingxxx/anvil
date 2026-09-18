import type { ModelInfo } from "@anvil/protocol";

export function groupedModels(models: ModelInfo[]): Array<{ provider: string; models: ModelInfo[] }> {
  const groups: Array<{ provider: string; models: ModelInfo[] }> = [];
  const index = new Map<string, number>();
  for (const model of models) {
    const existing = index.get(model.provider);
    if (existing === undefined) {
      index.set(model.provider, groups.length);
      groups.push({ provider: model.provider, models: [model] });
      continue;
    }
    groups[existing]?.models.push(model);
  }
  return groups;
}

export function findModel(models: ModelInfo[], modelId: string | null | undefined): ModelInfo | null {
  if (!modelId) {
    return null;
  }
  return models.find((model) => model.id === modelId) ?? null;
}
