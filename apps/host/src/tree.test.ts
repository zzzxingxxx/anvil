import { describe, expect, it } from "vitest";
import { buildTree, messagesOnPath, pathIdsFrom, seedsFromRpcTree } from "./tree.ts";

describe("session tree", () => {
  it("builds a 10-node tree with a current leaf", () => {
    const seeds = Array.from({ length: 10 }, (_, index) => ({
      id: `n${index}`,
      parentId: index === 0 ? null : `n${index - 1}`,
      summary: `节点 ${index}`,
    }));
    const tree = buildTree(seeds, "n9");
    expect(tree?.id).toBe("n0");
    let cursor = tree;
    let depth = 1;
    while (cursor?.children[0]) {
      cursor = cursor.children[0];
      depth += 1;
    }
    expect(depth).toBe(10);
    expect(cursor?.current).toBe(true);
  });

  it("walks path ids to a fork point", () => {
    const seeds = [
      { id: "a", parentId: null, summary: "a" },
      { id: "b", parentId: "a", summary: "b" },
      { id: "c", parentId: "b", summary: "c" },
    ];
    const ids = pathIdsFrom(seeds, "b");
    expect([...ids]).toEqual(["b", "a"]);
  });

  it("keeps the transcript when message ids do not match tree entry ids", () => {
    const messages = [
      { id: "msg-1", role: "user" as const, text: "你好", createdAt: 1 },
      { id: "msg-2", role: "assistant" as const, text: "在", createdAt: 2 },
    ];
    const kept = messagesOnPath(messages, new Set(["entry-a", "entry-b"]));
    expect(kept).toEqual(messages);
  });
});

describe("seedsFromRpcTree", () => {
  it("flattens sidecar tree nodes into Anvil seeds", () => {
    const seeds = seedsFromRpcTree([
      {
        entry: { id: "root", parentId: null, type: "message", message: { text: "开始" } },
        children: [
          {
            entry: { id: "leaf", parentId: "root", type: "compaction", summary: "压缩过" },
            label: "保留结论",
            children: [],
          },
        ],
      },
    ]);
    expect(seeds).toEqual([
      { id: "root", parentId: null, summary: "开始", status: "ok" },
      { id: "leaf", parentId: "root", summary: "保留结论", status: "compressed" },
    ]);
  });
});
