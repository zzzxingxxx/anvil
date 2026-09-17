import { describe, expect, it } from "vitest";
import { buildTree, pathIdsFrom } from "./tree.ts";

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
});
