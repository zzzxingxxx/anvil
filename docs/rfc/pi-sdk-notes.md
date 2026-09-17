# Pi SDK 对接笔记（0.85.1）

记录 `@earendil-works/pi-coding-agent@0.85.1` 实际导出，避免把 Pi 类型抄进 UI。

## 创建 runtime

- `createAgentSessionRuntime(factory, { cwd, agentDir, sessionManager })`
- factory 内：`createAgentSessionServices` → `createAgentSessionFromServices`
- cwd 变化必须重建 runtime（Anvil 在 `workspace.open` 时 `dispose` 再建）
- `agentDir` 用 `getAgentDir()`（默认 `~/.pi/agent`）

## 会话

- `SessionManager.create(cwd)` / `SessionManager.open(path)` / `SessionManager.list(cwd)`
- 默认目录：`~/.pi/agent/sessions/<encoded-cwd>/`
- Anvil 的 `session.id` **就是 jsonl 文件路径**，官方 `pi` 可 resume 同一文件
- `runtime.newSession()` / `runtime.switchSession(path)` 会先 teardown 再创建

## 事件

AgentSession 订阅的是 `AgentSessionEvent`，Anvil 映射：

| Pi | Anvil |
|---|---|
| `agent_start` | `agent/running` |
| `message_start/update/end` | `message/upsert` |
| `tool_execution_start/update/end` | `tool/start/update/end` |
| `agent_end` / `agent_settled` | `agent/idle` |

## 审批

- 内联 extension：`resourceLoaderOptions.extensionFactories`
- `pi.on("tool_call")` 可 `{ block: true, reason }`
- 策略纯函数在 `@anvil/pi-ext-gate`，不依赖 Pi 类型

## 模型

- `session.modelRuntime.getAvailable()`
- `session.setModel(model)`
- Anvil 模型 id 格式：`provider/modelId`

## 切换

- 默认走 SDK。CI / 无密钥：`ANVIL_FAKE_PI=1`
- 测试里 `useFakePi()` 在 `NODE_ENV=test` 或 `VITEST` 时也走假适配器
