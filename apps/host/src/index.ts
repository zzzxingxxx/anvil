import { createServer } from "node:http";
import {
  ANVIL_HEARTBEAT_MS,
  ANVIL_HOST_PORT,
  ANVIL_VERSION,
  ANVIL_WS_PATH,
  EnvelopeSchema,
  makeEvent,
  SnapshotEventSchema,
} from "@anvil/protocol";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocketServer, type WebSocket } from "ws";
import { ApprovalQueue } from "./approvals.ts";
import { chooseAdapterKind, loadConfig } from "./config.ts";
import { probeDocker } from "./docker.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { handleRequest } from "./handlers.ts";
import { logError, logInfo } from "./log.ts";
import type { PiAdapter } from "./pi-adapter.ts";
import { RpcPiAdapter } from "./rpc-pi-adapter.ts";
import { SdkPiAdapter } from "./sdk-pi-adapter.ts";
import { createWorkspaceState } from "./state.ts";
import { TaskOrchestrator } from "./tasks.ts";
import { messagesOnPath, pathIdsFrom } from "./tree.ts";

const bootConfig = await loadConfig();
const kind = chooseAdapterKind(bootConfig.settings?.trustDefault);
const fake = kind === "fake";
const rpc = kind === "rpc";
const state = createWorkspaceState(kind);
const approvals = new ApprovalQueue();
const adapter: PiAdapter = fake
  ? new FakePiAdapter(state, approvals)
  : rpc
    ? new RpcPiAdapter(state)
    : new SdkPiAdapter(state, approvals);
const tasks = new TaskOrchestrator(state, undefined, approvals);
const sockets = new Set<WebSocket>();

state.recentWorkspaces = bootConfig.recentWorkspaces;
state.settings = bootConfig.settings ?? {};
state.docker = await probeDocker();

adapter.subscribe((event) => {
  if (event.type === "session/replaced") {
    broadcast("snapshot", snapshot());
    return;
  }
  broadcast(event.type, event);
});

tasks.subscribe((event) => {
  broadcast(event.type, event);
});

const app = new Hono();
app.use(
  "*",
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "OPTIONS"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    version: ANVIL_VERSION,
    adapter: adapter.kind,
    cwd: state.cwd,
    metrics: {
      tasks: state.tasks.length,
      running: state.tasks.filter((item) => item.status === "running").length,
    },
    docker: state.docker,
  }),
);

const httpServer = createServer();
httpServer.on("request", getRequestListener(app.fetch));
const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (request, socket, head) => {
  const path = request.url?.split("?")[0];
  if (path !== ANVIL_WS_PATH) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (socket) => {
  sockets.add(socket);
  logInfo("ws connected", { clients: sockets.size });
  send(socket, "snapshot", snapshot());

  socket.on("message", async (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      send(socket, "agent/error", { type: "agent/error", error: "消息不是合法 JSON" });
      return;
    }
    const envelope = EnvelopeSchema.safeParse(parsed);
    if (!envelope.success || envelope.data.kind !== "req") {
      logInfo("drop invalid envelope");
      return;
    }
    const response = await handleRequest(envelope.data, state, adapter, approvals, tasks);
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(response));
    }
    if (
      envelope.data.type === "workspace.open" ||
      envelope.data.type === "workspace.trust" ||
      envelope.data.type === "session.new" ||
      envelope.data.type === "session.resume" ||
      envelope.data.type === "session.fork" ||
      envelope.data.type === "session.compact" ||
      envelope.data.type === "tree.navigate" ||
      envelope.data.type === "artifact.restore" ||
      envelope.data.type === "task.delegate" ||
      envelope.data.type === "task.cancel" ||
      envelope.data.type === "board.move" ||
      envelope.data.type === "settings.set" ||
      envelope.data.type === "model.set"
    ) {
      broadcast("snapshot", snapshot());
    }
  });

  socket.on("close", () => {
    sockets.delete(socket);
    logInfo("ws disconnected", { clients: sockets.size });
  });

  socket.on("error", (error) => {
    logError("ws error", { error: String(error) });
  });
});

const heartbeat = setInterval(() => {
  broadcast("heartbeat", { type: "heartbeat", ts: Date.now() });
}, ANVIL_HEARTBEAT_MS);
heartbeat.unref();

httpServer.on("error", (error) => {
  logError("listen failed", { error: String(error), port: ANVIL_HOST_PORT });
  process.exitCode = 1;
});
httpServer.listen(ANVIL_HOST_PORT, "127.0.0.1", () => {
  logInfo("listening", { port: ANVIL_HOST_PORT, ws: ANVIL_WS_PATH, adapter: adapter.kind });
});

function snapshot() {
  return SnapshotEventSchema.parse({
    type: "snapshot",
    cwd: state.cwd,
    trust: state.trust,
    sessionId: state.sessionId,
    sessionTitle: state.sessionTitle,
    modelId: state.model?.id ?? null,
    modelLabel: state.model?.label ?? null,
    agentStatus: state.agentStatus,
    messages: visibleMessages(state),
    tools: state.tools,
    usage: state.usage,
    sessions: state.sessions,
    models: state.models,
    recentWorkspaces: state.recentWorkspaces,
    pendingApproval: state.pendingApproval,
    adapter: state.adapterKind,
    tree: state.tree,
    changes: state.changes,
    currentEntryId: state.currentEntryId,
    tasks: state.tasks,
    settings: state.settings,
    docker: state.docker,
  });
}

function broadcast(type: string, payload: unknown): void {
  const envelope = makeEvent(type, payload);
  const raw = JSON.stringify(envelope);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(raw);
    }
  }
}

function send(socket: WebSocket, type: string, payload: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(makeEvent(type, payload)));
  }
}

function visibleMessages(state: ReturnType<typeof createWorkspaceState>) {
  if (!state.currentEntryId || state.treeSeeds.length === 0) {
    return state.messages;
  }
  return messagesOnPath(state.messages, pathIdsFrom(state.treeSeeds, state.currentEntryId));
}
