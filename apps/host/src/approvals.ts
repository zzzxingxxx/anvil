import type { ApprovalDecision, ApprovalRequest } from "@anvil/protocol";

const TIMEOUT_MS = 5 * 60 * 1000;

type Pending = {
  request: ApprovalRequest;
  resolve: (decision: ApprovalDecision) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ApprovalQueue {
  private pending = new Map<string, Pending>();

  get current(): ApprovalRequest | null {
    const first = this.pending.values().next().value as Pending | undefined;
    return first?.request ?? null;
  }

  wait(request: ApprovalRequest): Promise<ApprovalDecision> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId);
        resolve("deny");
      }, TIMEOUT_MS);
      this.pending.set(request.requestId, { request, resolve, timer });
    });
  }

  respond(requestId: string, decision: ApprovalDecision): boolean {
    const item = this.pending.get(requestId);
    if (!item) {
      return false;
    }
    clearTimeout(item.timer);
    this.pending.delete(requestId);
    item.resolve(decision);
    return true;
  }

  rejectAll(): void {
    for (const [id, item] of this.pending) {
      clearTimeout(item.timer);
      item.resolve("deny");
      this.pending.delete(id);
    }
  }
}
