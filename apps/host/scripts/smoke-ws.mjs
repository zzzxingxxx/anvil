import { WebSocket } from "ws";

const url = "ws://127.0.0.1:4317/ws";
const ws = new WebSocket(url);
const events = [];

function done(code) {
  console.log(JSON.stringify({ events, code }, null, 2));
  ws.close();
  process.exit(code);
}

const timer = setTimeout(() => {
  console.error("timeout waiting for fake loop");
  done(1);
}, 4000);

ws.on("open", () => {
  ws.send(
    JSON.stringify({
      id: "smoke-1",
      kind: "req",
      type: "agent.prompt",
      payload: { text: "你好" },
    }),
  );
});

ws.on("message", (raw) => {
  const msg = JSON.parse(String(raw));
  events.push(`${msg.kind}:${msg.type}`);
  const payloadType = msg.payload && msg.payload.type;
  if (payloadType) events.push(`payload:${payloadType}`);
  if (msg.kind === "ev" && msg.type === "agent/idle") {
    clearTimeout(timer);
    const ok =
      events.includes("payload:snapshot") &&
      events.includes("res:agent.prompt") &&
      events.includes("payload:message/upsert") &&
      events.includes("payload:tool/start") &&
      events.includes("payload:tool/end") &&
      events.includes("payload:agent/idle");
    done(ok ? 0 : 2);
  }
});

ws.on("error", (error) => {
  console.error(String(error));
  clearTimeout(timer);
  done(1);
});
