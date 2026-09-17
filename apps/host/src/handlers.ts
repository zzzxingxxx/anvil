import {
  CommandPayloadSchemas,
  type CommandType,
  CommandTypeSchema,
  type Envelope,
  ErrorPayloadSchema,
  makeResponse,
} from "@anvil/protocol";
import { loadConfig, rememberWorkspace, saveConfig, trustFor } from "./config.ts";
import { writeFile } from "node:fs/promises";
import { listTree, readTextFile } from "./fs-ops.ts";
import { searchFiles } from "./search.ts";
import { logInfo } from "./log.ts";
import type { PiAdapter } from "./pi-adapter.ts";
import { resetConversation, type WorkspaceState } from "./state.ts";
import { resolveInside, resolveWorkspacePath } from "./workspace.ts";
import type { ApprovalQueue } from "./approvals.ts";
import type { TaskOrchestrator } from "./tasks.ts";

type HandlerResult = { ok: true } & Record<string, unknown>;

export async function handleRequest(
  envelope: Envelope,
  state: WorkspaceState,
  adapter: PiAdapter,
  approvals: ApprovalQueue,
  tasks?: TaskOrchestrator,
): Promise<Envelope> {
  const parsedType = CommandTypeSchema.safeParse(envelope.type);
  if (!parsedType.success) {
    return makeResponse(envelope.id, envelope.type, {
      ok: false,
      error: `未知命令：${envelope.type}`,
      code: "unknown_command",
    });
  }

  const type = parsedType.data;
  const payloadParsed = CommandPayloadSchemas[type].safeParse(envelope.payload ?? {});
  if (!payloadParsed.success) {
    return makeResponse(envelope.id, type, {
      ok: false,
      error: "参数无效",
      code: "invalid_payload",
    });
  }

  try {
    const result = await dispatch(type, payloadParsed.data, state, adapter, approvals, tasks);
    logInfo("command", { type, ok: true });
    return makeResponse(envelope.id, type, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logInfo("command", { type, ok: false, error: message });
    const payload = ErrorPayloadSchema.parse({
      ok: false,
      error: message,
      code: "handler_error",
    });
    return makeResponse(envelope.id, type, payload);
  }
}

async function dispatch(
  type: CommandType,
  payload: unknown,
  state: WorkspaceState,
  adapter: PiAdapter,
  approvals: ApprovalQueue,
  tasks?: TaskOrchestrator,
): Promise<HandlerResult> {
  switch (type) {
    case "workspace.open": {
      const { path, trust: requested } = payload as { path: string; trust?: "trusted" | "untrusted" };
      const resolved = await resolveWorkspacePath(path);
      const config = await loadConfig();
      const trust = requested ?? trustFor(config, resolved);
      state.cwd = resolved;
      state.trust = trust;
      const next = rememberWorkspace(config, resolved, trust);
      await saveConfig(next);
      state.recentWorkspaces = next.recentWorkspaces;
      resetConversation(state);
      if (adapter.openWorkspace) {
        await adapter.openWorkspace(resolved);
      }
      return { ok: true, path: resolved, trust, recent: next.recentWorkspaces };
    }
    case "workspace.trust": {
      if (!state.cwd) {
        throw new Error("请先打开工作区");
      }
      const { trust } = payload as { trust: "trusted" | "untrusted" };
      state.trust = trust;
      const config = await loadConfig();
      const next = rememberWorkspace(config, state.cwd, trust);
      await saveConfig(next);
      state.recentWorkspaces = next.recentWorkspaces;
      return { ok: true, path: state.cwd, trust };
    }
    case "session.list": {
      const sessions = adapter.listSessions ? await adapter.listSessions() : state.sessions;
      state.sessions = sessions;
      return { ok: true, sessions, currentId: state.sessionId };
    }
    case "session.new": {
      const title = (payload as { title?: string }).title;
      if (adapter.newSession) {
        const session = await adapter.newSession(title);
        return { ok: true, session: { id: session.id, title: session.title } };
      }
      const session = {
        id: `sess-fake-${state.sessions.length + 1}`,
        title: title ?? `会话 ${state.sessions.length + 1}`,
        mtime: Date.now(),
        tokens: 0,
      };
      state.sessions.unshift(session);
      state.sessionId = session.id;
      state.sessionTitle = session.title;
      resetConversation(state);
      return { ok: true, session: { id: session.id, title: session.title } };
    }
    case "session.resume": {
      const { id } = payload as { id: string };
      if (adapter.resumeSession) {
        const session = await adapter.resumeSession(id);
        return { ok: true, session: { id: session.id, title: session.title } };
      }
      const found = state.sessions.find((item) => item.id === id);
      if (!found) {
        throw new Error("会话不存在");
      }
      state.sessionId = found.id;
      state.sessionTitle = found.title;
      resetConversation(state);
      return { ok: true, session: { id: found.id, title: found.title } };
    }
    case "session.fork": {
      const { entryId } = payload as { entryId: string };
      if (!adapter.fork) {
        throw new Error("当前适配器不支持分叉");
      }
      const session = await adapter.fork(entryId);
      return { ok: true, session: { id: session.id, title: session.title } };
    }
    case "tree.navigate": {
      const { entryId } = payload as { entryId: string };
      if (!adapter.navigate) {
        throw new Error("当前适配器不支持树导航");
      }
      await adapter.navigate(entryId);
      return { ok: true };
    }
    case "session.compact": {
      const { instructions } = payload as { instructions?: string };
      if (!adapter.compact) {
        throw new Error("当前适配器不支持压缩");
      }
      await adapter.compact(instructions);
      return { ok: true };
    }
    case "agent.prompt": {
      const { text } = payload as { text: string };
      void adapter.prompt({ text });
      return { ok: true };
    }
    case "agent.steer": {
      const { text } = payload as { text: string };
      await adapter.steer(text);
      return { ok: true };
    }
    case "agent.followUp": {
      const { text } = payload as { text: string };
      await adapter.followUp(text);
      return { ok: true };
    }
    case "agent.abort":
      await adapter.abort();
      return { ok: true };
    case "approval.respond": {
      const { requestId, decision } = payload as {
        requestId: string;
        decision: "allow-once" | "deny";
      };
      const ok = approvals.respond(requestId, decision);
      if (!ok) {
        throw new Error("没有等待中的审批，或已超时");
      }
      if (state.pendingApproval?.requestId === requestId) {
        state.pendingApproval = null;
      }
      return { ok: true };
    }
    case "model.list": {
      const models = adapter.listModels ? await adapter.listModels() : state.models;
      state.models = models;
      return { ok: true, models, currentId: state.model?.id ?? null };
    }
    case "model.set": {
      const { id } = payload as { id: string };
      if (adapter.setModel) {
        const model = await adapter.setModel(id);
        state.model = model;
        return { ok: true, model };
      }
      const model = state.models.find((item) => item.id === id);
      if (!model) {
        throw new Error("模型不存在");
      }
      state.model = model;
      return { ok: true, model };
    }
    case "fs.tree": {
      if (!state.cwd) {
        throw new Error("请先打开工作区");
      }
      const { path } = payload as { path?: string };
      const result = await listTree(state.cwd, path);
      return { ok: true, ...result };
    }
    case "fs.read": {
      if (!state.cwd) {
        throw new Error("请先打开工作区");
      }
      const { path } = payload as { path: string };
      const result = await readTextFile(state.cwd, path);
      return { ok: true, ...result };
    }
    case "fs.search": {
      if (!state.cwd) {
        throw new Error("请先打开工作区");
      }
      const { query } = payload as { query: string };
      const hits = await searchFiles(state.cwd, query);
      return { ok: true, hits };
    }
    case "artifact.restore": {
      if (!state.cwd) {
        throw new Error("请先打开工作区");
      }
      const { path } = payload as { path: string };
      const snap = state.snapshots[path];
      if (!snap || snap.before == null) {
        throw new Error("没有可还原的快照");
      }
      const abs = resolveInside(state.cwd, path);
      await writeFile(abs, snap.before, "utf8");
      state.changes = state.changes.filter((item) => item.path !== path);
      return { ok: true };
    }
    case "task.delegate": {
      if (!tasks) {
        throw new Error("任务编排未启动");
      }
      const payloadIn = payload as {
        goal: string;
        persona?: "architect" | "implementer" | "reviewer";
        cwd?: string;
      };
      const task = await tasks.delegate(payloadIn);
      return { ok: true, task };
    }
    case "task.cancel": {
      if (!tasks) {
        throw new Error("任务编排未启动");
      }
      const { id } = payload as { id: string };
      tasks.cancel(id);
      return { ok: true };
    }
    case "task.list": {
      return { ok: true, tasks: state.tasks };
    }
  }
}
