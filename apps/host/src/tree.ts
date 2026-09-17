import type { TreeNode, UiMessage } from "@anvil/protocol";

export type TreeSeed = {
  id: string;
  parentId: string | null;
  summary: string;
  status?: TreeNode["status"];
};

export function buildTree(seeds: TreeSeed[], currentId: string | null): TreeNode | null {
  if (seeds.length === 0) {
    return null;
  }
  const nodes = new Map<string, TreeNode>();
  for (const seed of seeds) {
    nodes.set(seed.id, {
      id: seed.id,
      parentId: seed.parentId,
      summary: seed.summary,
      status: seed.status ?? "ok",
      current: seed.id === currentId,
      children: [],
    });
  }
  const roots: TreeNode[] = [];
  for (const seed of seeds) {
    const node = nodes.get(seed.id);
    if (!node) continue;
    if (seed.parentId && nodes.has(seed.parentId)) {
      nodes.get(seed.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  if (roots.length === 1) {
    return roots[0] ?? null;
  }
  return {
    id: "root",
    parentId: null,
    summary: "会话树",
    status: "ok",
    current: currentId === "root",
    children: roots,
  };
}

export function messagesOnPath(messages: UiMessage[], pathIds: Set<string> | null): UiMessage[] {
  if (!pathIds) {
    return messages;
  }
  return messages.filter((message) => pathIds.has(message.id) || message.role === "system");
}

export function pathIdsFrom(seeds: TreeSeed[], leafId: string | null): Set<string> {
  const byId = new Map(seeds.map((seed) => [seed.id, seed]));
  const ids = new Set<string>();
  let cursor = leafId;
  while (cursor && byId.has(cursor)) {
    ids.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return ids;
}

export function demoTree(messages: UiMessage[], currentId: string | null): {
  tree: TreeNode | null;
  seeds: TreeSeed[];
} {
  const seeds: TreeSeed[] = messages
    .filter((message) => message.role !== "system")
    .map((message, index, list) => ({
      id: message.id,
      parentId: index === 0 ? null : list[index - 1]?.id ?? null,
      summary: clip(message.text),
      status: "ok" as const,
    }));
  return { tree: buildTree(seeds, currentId ?? seeds.at(-1)?.id ?? null), seeds };
}

function clip(text: string): string {
  const line = text.split(/\r?\n/).find((item) => item.trim())?.trim() ?? "（空）";
  return line.length > 42 ? `${line.slice(0, 42)}…` : line;
}
