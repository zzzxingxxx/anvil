import { personaAllowsWrite, type PersonaId } from "./personas.ts";

export const MAX_CONCURRENT = 2;

export type DelegateRequest = {
  goal: string;
  persona: PersonaId | string;
  cwd?: string;
  trust: "trusted" | "untrusted";
  parentIsChild: boolean;
  runningCount: number;
  workspaceRoot: string;
};

export function canDelegate(req: DelegateRequest): { ok: true } | { ok: false; reason: string } {
  if (req.parentIsChild) {
    return { ok: false, reason: "子会话禁止再次委派（深度 1）" };
  }
  if (!req.goal.trim()) {
    return { ok: false, reason: "缺少目标" };
  }
  if (req.trust !== "trusted" && personaAllowsWrite(req.persona)) {
    return { ok: false, reason: "未信任项目不能派出可写子 Agent" };
  }
  if (req.cwd) {
    const rel = req.cwd.replace(/\\/g, "/");
    if (rel.startsWith("..") || rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) {
      return { ok: false, reason: "子任务 cwd 必须是工作区内相对路径" };
    }
  }
  return { ok: true };
}

export function shouldQueue(runningCount: number): boolean {
  return runningCount >= MAX_CONCURRENT;
}
