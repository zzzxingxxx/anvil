export function normalizeLockPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

export class FileLockTable {
  private readonly owner = new Map<string, string>();

  tryLock(taskId: string, path: string): { ok: true } | { ok: false; owner: string } {
    const key = normalizeLockPath(path);
    const current = this.owner.get(key);
    if (current && current !== taskId) {
      return { ok: false, owner: current };
    }
    this.owner.set(key, taskId);
    return { ok: true };
  }

  release(taskId: string): void {
    for (const [path, owner] of this.owner) {
      if (owner === taskId) {
        this.owner.delete(path);
      }
    }
  }

  ownerOf(path: string): string | undefined {
    return this.owner.get(normalizeLockPath(path));
  }
}
