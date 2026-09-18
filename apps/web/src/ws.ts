import { ANVIL_WS_PATH, EnvelopeSchema, makeRequest, type Envelope } from "@anvil/protocol";
import { useUiStore } from "./store.ts";

type Pending = {
  resolve: (envelope: Envelope) => void;
  reject: (error: Error) => void;
  timer: number;
};

const REQUEST_TIMEOUT_MS = 30_000;

class AnvilClient {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private retries = 0;
  private closedByUser = false;
  private generation = 0;
  private reconnectTimer: number | null = null;

  connect(): void {
    this.closedByUser = false;
    this.generation += 1;
    this.open(this.generation);
  }

  disconnect(): void {
    this.closedByUser = true;
    this.generation += 1;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  async request(type: string, payload: unknown): Promise<Envelope> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("尚未连接到 Host");
    }
    const envelope = makeRequest(type, payload);
    const raw = JSON.stringify(envelope);
    const response = await new Promise<Envelope>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(envelope.id);
        reject(new Error("请求超时"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(envelope.id, { resolve, reject, timer });
      this.socket?.send(raw);
    });
    const payloadOut = response.payload as { ok?: boolean; error?: string } | undefined;
    if (payloadOut && payloadOut.ok === false) {
      throw new Error(payloadOut.error || "命令失败");
    }
    if (useUiStore.getState().lastError) {
      useUiStore.setState({ lastError: null });
    }
    return response;
  }

  private open(generation: number): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    useUiStore.getState().setConnection("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}${ANVIL_WS_PATH}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.generation !== generation) {
        socket.close();
        return;
      }
      this.retries = 0;
      useUiStore.getState().setConnection("open");
    });

    socket.addEventListener("message", (event) => {
      if (this.generation !== generation) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const envelope = EnvelopeSchema.safeParse(parsed);
      if (!envelope.success) {
        return;
      }
      if (envelope.data.kind === "res") {
        const waiter = this.pending.get(envelope.data.id);
        if (waiter) {
          window.clearTimeout(waiter.timer);
          this.pending.delete(envelope.data.id);
          waiter.resolve(envelope.data);
        }
        return;
      }
      if (envelope.data.kind === "ev") {
        useUiStore.getState().applyEvent(envelope.data.payload);
      }
    });

    socket.addEventListener("error", () => {
      if (this.generation !== generation) {
        return;
      }
      useUiStore.getState().setConnection("closed");
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      for (const waiter of this.pending.values()) {
        window.clearTimeout(waiter.timer);
        waiter.reject(new Error("连接已断开"));
      }
      this.pending.clear();
      if (this.closedByUser || this.generation !== generation) {
        return;
      }
      useUiStore.getState().setConnection("closed");
      const delay = Math.min(8000, 400 * 2 ** this.retries);
      this.retries += 1;
      this.reconnectTimer = window.setTimeout(() => this.open(this.generation), delay);
    });
  }
}

export const client = new AnvilClient();
