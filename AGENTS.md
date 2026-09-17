# Anvil 开发约定

给人类和 Agent。改这个仓库前先读完。

## 产品边界

- 引擎是 Earendil Pi。**不 fork Pi，不重写 Agent Runtime，不发明私有 session 格式。**
- 工作台只做宿主：会话 UI、审批、编排、制品、可观测性。
- 新能力优先写成 Pi Extension / Skill / Package，而不是改 Host 内核。
- 离开 Anvil，用官方 `pi` 必须能 resume 同一份 jsonl。破坏兼容性是发布事故。

## 进程边界

- `apps/web` 只渲染、只发意图。禁止直接读盘、开 shell、碰密钥。
- `apps/host` 拥有桌面权力：工作区、信任、Git、PTY、审批队列、Pi adapter。
- 前后端共享类型只放 `packages/protocol`。协议变更必须改该包，并让 host / web 双边 `pnpm check` 通过。
- 端口写死在 protocol：Host `127.0.0.1:4317`，Web `127.0.0.1:5173`，WS 路径 `/ws`。不要抢 3080 或 4310（4310 常被 QQ 占用）。

## Phase 3 现状

- 默认 `SdkPiAdapter`（`@earendil-works/pi-coding-agent@0.85.1`）。
- `ANVIL_FAKE_PI=1` 或测试环境走 `FakePiAdapter`。
- 审批策略在 `packages/pi-ext-gate`，SDK 用内联 extension 的 `tool_call` 挂钩。
- 设计系统仍写在 `apps/web`，不要急着抽 `packages/ui`。
- `apps/desktop` 空着，Phase 4 再做壳。
- SDK 实际 API 记在 `docs/rfc/pi-sdk-notes.md`。

## 工程

- Node 22+，pnpm workspace，TypeScript ESM。
- 不提交密钥、真实 session、sqlite、`.anvil/`。
- 日志脱敏，不打 prompt 全文和 token。
- 单人开发顺序：协议 → Host / FakeAdapter → UI → 真 Adapter。
- 超时就砍 P1。阶段门没过，禁止开始下一阶段。
