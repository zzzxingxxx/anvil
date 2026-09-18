# Anvil

以 [Earendil Pi](https://pi.dev) 为引擎的本地优先 AI Agent 工作台。

当前进度：**Phase 4 演示版**。看板、设置、RPC sidecar 开关、`anvil.cmd` 一键启动。检查器有制品列表，Composer 支持 `/compact` `/new` `/abort`。真模型 dogfood 仍需能完成一轮推理的模型。

- 产品：[docs/项目描述.md](docs/项目描述.md)
- 计划：[docs/开发计划.md](docs/开发计划.md)
- 约定：[AGENTS.md](AGENTS.md)
- SDK 笔记：[docs/rfc/pi-sdk-notes.md](docs/rfc/pi-sdk-notes.md)

## 要求

- Node.js 22.19+
- pnpm 9+（仓库 `packageManager` 为 pnpm 11.7.0）
- Windows 优先；只占用本机 `127.0.0.1`
- 真模型：本机已配置 Pi（环境变量或 `pi` 登录）

## 启动

```bash
pnpm install
pnpm start
```

或双击仓库根目录 `anvil.cmd`。桌面壳：先 `pnpm start`，再 `pnpm desktop`（`npx electron`，未进 lockfile）。Windows 未签名，SmartScreen 可能提示。

打开 **http://127.0.0.1:5173**。

| 进程 | 地址 |
|---|---|
| Web | http://127.0.0.1:5173 |
| Host | http://127.0.0.1:4317 |
| 健康检查 | http://127.0.0.1:4317/health |
| WebSocket | `ws://127.0.0.1:4317/ws`（开发时由 Vite 代理） |

Host 不用 4310：Windows 上该端口常被 QQ 占用。

浏览器**不能**弹系统文件框。在左侧粘贴绝对路径打开工作区，例如：

```
F:\adfadda\demo2342\demooo
```

最近项目记在 `~/.anvil/config.json`。默认 **未信任**：禁止 bash / write / edit。点顶栏「沙箱保护」切换为信任后，bash 仍会弹出「允许一次 / 拒绝」。

## 真 Pi 与假循环

默认使用 `@earendil-works/pi-coding-agent@0.85.1`。没有配置模型时，顶栏会显示中文空状态。

强制假循环（CI / 没密钥）：

```bash
# Windows PowerShell
$env:ANVIL_FAKE_PI="1"; pnpm --filter host dev
```

未信任仓库可切 RPC sidecar：

```bash
$env:ANVIL_PI_MODE="rpc"; pnpm --filter host dev
```

测试默认走假适配器，不连网。

会话文件就是官方 Pi jsonl（`~/.pi/agent/sessions/...`）。Anvil 产生的 session，终端里 `pi` 应能 resume。

## 常用命令

```bash
pnpm check    # protocol + gate + host + web
pnpm test     # 不连网：假 adapter + 闸门策略
pnpm build
```

## 仓库结构

```
apps/web                 工作台 UI
apps/host                Node Host（工作区、审批、Pi adapter）
apps/desktop             Phase 4 桌面壳
packages/protocol        共享协议
packages/pi-ext-gate     审批策略（纯函数）
packages/pi-ext-*        后续扩展占位
docs/
```

## 常见问题

**发消息没反应？** 先打开工作区。未打开时发送按钮是禁用的。

**工具被拒绝？** 未信任仓库禁止 bash/write。先点顶栏切到信任模式，再在审批卡点「允许一次」。

**没有模型？** 设置 `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`，或在终端运行 `pi` 登录后重启 Host。临时演示可 `ANVIL_FAKE_PI=1`。

**刷新后对话还在吗？** Host 进程还在就会推 snapshot。Host 重启后运行态丢失，但 Pi session 文件仍在，可从左侧列表 resume。

**官方 pi 打得开吗？** 可以。不要改 session 格式；Anvil 的会话 id 就是 jsonl 路径。

## 已知问题

- 本机自定义 Pi provider 标 ready，但 `pi -p` 一轮失败（模型不支持 / 要 1m 上下文 / 无账号 / 流中断）。真改文件、分叉二选一、真 SDK 子 runtime 未跑。
- 子任务会写合法 Pi jsonl，并跑独立假循环。
- 桌面壳是开发版 Electron（`pnpm desktop`），没有安装包。Windows 未签名。
- Docker 只做探测，未验证整进程进容器。
- 人用 PTY 终端按 Phase 2 减载推迟。
