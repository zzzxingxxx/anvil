import type { AnvilEvent } from "@anvil/protocol";
import { captureAfter, captureBefore, toolPath } from "./artifacts.ts";
import { eventFromSdk, stringifyPartial, toUiMessage, usageFromMessage } from "./sdk-map.ts";
import { recordUsage } from "./usage-ledger.ts";
import { upsertMessage, upsertTool, type WorkspaceState } from "./state.ts";

type PiWireEvent = { type: string } & Record<string, unknown>;

export function applyPiSessionEvent(
  state: WorkspaceState,
  event: PiWireEvent,
  emit: (event: AnvilEvent) => void,
  options: { captureArtifacts?: boolean; onAgentEnd?: () => void } = {},
): void {
  const mapped = eventFromSdk(event);
  if (mapped) {
    if (mapped.type === "agent/running") {
      state.agentStatus = "running";
    }
    if (mapped.type === "agent/idle") {
      state.agentStatus = "idle";
    }
    emit(mapped);
  }

  if (event.type === "message_start" || event.type === "message_update" || event.type === "message_end") {
    const streaming = event.type !== "message_end";
    const message = resolveMessage(event);
    const ui = toUiMessage(message, streaming);
    if (ui) {
      upsertMessage(state, ui);
      emit({ type: "message/upsert", message: ui });
    }
    const nextUsage = usageFromMessage(message, state.usage);
    if (event.type === "message_end" && nextUsage) {
      const delta = {
        inputTokens: Math.max(0, nextUsage.inputTokens - state.usage.inputTokens),
        outputTokens: Math.max(0, nextUsage.outputTokens - state.usage.outputTokens),
        cacheReadTokens: Math.max(0, (nextUsage.cacheReadTokens ?? 0) - (state.usage.cacheReadTokens ?? 0)),
        cacheWriteTokens: Math.max(0, (nextUsage.cacheWriteTokens ?? 0) - (state.usage.cacheWriteTokens ?? 0)),
        costUsd: Math.max(0, (nextUsage.costUsd ?? 0) - (state.usage.costUsd ?? 0)),
      };
      state.usage = nextUsage;
      emit({ type: "usage/update", tokens: nextUsage });
      void recordUsage(delta);
    }
  }

  if (event.type === "tool_execution_start") {
    const callId = String(event.toolCallId ?? "");
    const name = String(event.toolName ?? "tool");
    upsertTool(state, {
      callId,
      name,
      args: event.args,
      status: "running",
      output: "",
    });
    emit({
      type: "tool/start",
      callId,
      name,
      args: event.args,
    });
    const path = toolPath(event.args);
    if (options.captureArtifacts && path && (name === "write" || name === "edit")) {
      void captureBefore(state, path);
    }
  }

  if (event.type === "tool_execution_update") {
    const callId = String(event.toolCallId ?? "");
    const partial = stringifyPartial(event.partialResult);
    const existing = state.tools.find((item) => item.callId === callId);
    upsertTool(state, {
      callId,
      name: String(event.toolName ?? existing?.name ?? "tool"),
      args: event.args ?? existing?.args,
      status: "running",
      output: existing ? `${existing.output}${partial}` : partial,
    });
    emit({ type: "tool/update", callId, partial });
  }

  if (event.type === "tool_execution_end") {
    const callId = String(event.toolCallId ?? "");
    const name = String(event.toolName ?? "tool");
    const output = stringifyPartial(event.result);
    const isError = Boolean(event.isError);
    upsertTool(state, {
      callId,
      name,
      args: event.args ?? {},
      status: isError ? "error" : "success",
      output,
    });
    emit({
      type: "tool/end",
      callId,
      ok: !isError,
      result: output,
    });
    const path = toolPath(state.tools.find((item) => item.callId === callId)?.args ?? event.args);
    if (options.captureArtifacts && !isError && path && (name === "write" || name === "edit")) {
      void captureAfter(state, path).then(() => {
        emit({
          type: "fs/changed",
          paths: [path],
          changes: state.changes,
        });
      });
    }
  }

  if (event.type === "agent_end") {
    const last = state.messages.at(-1);
    if (last?.streaming) {
      last.streaming = false;
      emit({ type: "message/upsert", message: { ...last } });
    }
    options.onAgentEnd?.();
  }
}

function resolveMessage(event: PiWireEvent): unknown {
  if (event.message) {
    return event.message;
  }
  const assistant = event.assistantMessageEvent;
  if (assistant && typeof assistant === "object" && "partial" in assistant) {
    return (assistant as { partial: unknown }).partial;
  }
  return undefined;
}
