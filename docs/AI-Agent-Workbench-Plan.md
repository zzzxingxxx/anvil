# 自研 AI Agent 工作台详细方案

> 底座：**Earendil Pi**（`@earendil-works/pi-coding-agent` / [pi.dev](https://pi.dev)）
> 原则：**不 fork Pi，不重写 Agent Runtime**。工作台只做「操作系统」，Pi 做「引擎」。
> 工作区：`F:\adfadda\demo2342\demooo`（当前为空，本文件是立项文档）

---

## 0. 一句话定位

做一个 **Windows 优先、本地优先、中文优先** 的 Agent 工作台：

- 人负责目标、分叉、审批、编排
- Pi 负责读改文件、跑命令、推理、工具循环
- 工作台负责会话、多 Agent、制品、权限、可观测性、工作流

不是「给 Pi 套一层 Electron 聊天窗」，而是 **以 Pi 为内核的 Agent IDE / 指挥中心**。

建议产品名（待定）：**Anvil（铁砧）** / **Loom（织机）** / **工坊**。下文暂用 **Anvil**。

---

## 1. 为什么以 Pi 为基地，而不是自研 Agent

Pi 已经把最难、最不该自研的部分做完了：

| Pi 已提供 | 包 | 工作台是否该重写 |
|---|---|---|
| 多厂商 LLM 统一层 | `@earendil-works/pi-ai` | 否 |
| Agent 循环、工具调用、事件流 | `@earendil-works/pi-agent-core` | 否 |
| 会话、分叉、压缩、扩展/技能/模板 | `@earendil-works/pi-coding-agent` | 否 |
| SDK / RPC / JSON 事件流 | 同上 | 作为宿主接口 |
| TUI | `@earendil-works/pi-tui` | 不用，我们做 GUI |

Pi 的设计哲学正好适合自研工作台：

- 核心刻意做小：默认只有 `read / write / edit / bash`
- 子 Agent、Plan Mode、权限系统 **故意不做**，留给扩展和宿主
- 四种嵌入方式：交互、print/JSON、**RPC**、**SDK**
- 会话是树，不是线性聊天

这意味着：自研价值不在「再做一个 Claude Code」，而在 **宿主层能力**。

---

## 2. 竞品地图：不要做成第 N 个 OpenPi

现有 Pi 工作台已经不少，直接抄会没有存在理由。

| 产品 | 强项 | 缺口（我们可以打） |
|---|---|---|
| **OpenPi** | Electron 壳、sidecar 托管 Pi SDK、Git/Diff/终端/自定义项 | 会话仍偏线性聊天；编排弱；macOS 心智；中文体验一般 |
| **PiX** | 非线性会话树、多列对比、上下文跟随分支 | 工作流/多 Agent/制品中心弱 |
| **pi-workbench** | Kanban/DAG、可检视 Agent 团队 | 早期，完成度低 |
| **EnsoCode** | 多 Agent 舰队叙事 | 产品化不足 |
| **Bivor** | macOS 原生桌面 | 非 Windows |
| **Nerve** | 透明、local-first | 偏小 harness |

**Anvil 的差异化必须同时满足三点：**

1. **树状会话是一等公民**（吸收 PiX，而不是做成附属可视化）
2. **多 Agent 编排是一等公民**（Pi 官方不做 subagent，这是最大空白）
3. **制品 + 审批 + 权限是一等公民**（Pi 无内置权限系统，这是最大风险也是最大产品机会）

一句话：**OpenPi 是 Pi 的桌面皮肤；Anvil 是 Pi 的操作系统。**

---

## 3. 目标用户与核心场景

### 3.1 首发用户

个人全栈 / 独立开发者（就是你自己先用）：

- Windows 主力
- 同时开多个仓库
- 需要「调研 / 改代码 / 写方案 / 跑命令」混在一起
- 愿意为可控性牺牲一点「全自动魔法」

### 3.2 核心场景（按价值排序）

1. **单仓库结对编程**：打开项目 → 选模型 → 对话 → 看 diff → 接受/拒绝 → 提交
2. **分叉探索**：同一问题试 3 种方案，保留树，选赢的那条继续
3. **主从协作**：主 Agent 拆任务，子 Agent 并行改不同模块，主 Agent 汇总
4. **带审批的长任务**：危险命令、删文件、推远程，必须人点头
5. **可回放**：任何一次失败都能从树节点重放、压缩、导出

非目标（v1 明确不做）：

- 云端多租户 SaaS
- 替代 VS Code / 完整 IDE
- 通用 ChatGPT 套壳
- 自动在生产环境改基础设施

---

## 4. 产品原则

1. **Pi 拥有 Agent 语义。** 会话树、compaction、tool loop、extensions、providers 全部走 Pi。工作台不得私造另一套 session 格式。
2. **UI 只渲染，不碰特权。** 渲染进程不能直接读盘、开 shell、碰密钥。
3. **Host 拥有桌面权力。** 文件系统策略、PTY、Git、密钥、沙箱、进程监督在 Host。
4. **扩展走 Pi 官方机制。** 新能力优先写成 Pi Extension / Skill / Package，而不是改 Host 内核。
5. **默认可观察。** 每次 tool call、每次模型切换、每次花费，都必须能点开看。
6. **默认要人在回路。** 高风险动作默认 Ask；可按项目调成 Never / Allowlist。
7. **中文是一等公民。** 文档、空状态、快捷键提示、错误信息全部中文；模型提示词可中英双轨。

---

## 5. 信息架构（用户看到什么）

```
┌────────────┬──────────────────────────────┬─────────────────────┐
│ 工作区     │ 主舞台（可切换）              │ 检查器              │
│            │                              │                     │
│ 项目列表   │ [对话] [会话树] [Diff]       │ 当前节点详情        │
│ 会话列表   │ [终端] [制品] [工作流看板]    │ 工具调用时间线      │
│ Agent 角色 │                              │ Token / 费用        │
│ 运行中任务 │ 底部：Composer（输入/steer）  │ 权限/队列/模型      │
└────────────┴──────────────────────────────┴─────────────────────┘
全局：命令面板、模型选择、状态栏（cwd / session / tokens / cost / model）
```

### 5.1 左侧：工作区

- **项目（Workspace）**：一个 git 仓库或文件夹 = 一个信任边界
- **会话（Session）**：真实的 Pi jsonl 会话，按项目分组
- **角色（Persona）**：一组 system prompt + tools + skills + 模型偏好（例如「架构师 / 实现者 / 审查者」）
- **运行中**：所有 Agent / 子任务的活状态

### 5.2 主舞台六视图

| 视图 | 作用 | 数据来源 |
|---|---|---|
| 对话 | 当前分支的消息流、工具卡片 | Pi `AgentSession` 事件 |
| 会话树 | 节点=一轮 user+assistant+tools；可 fork / 克隆 / 跳转 | Pi session tree |
| Diff | 本轮或本会话的文件变更，可块级接受 | Host 快照 + git |
| 终端 | 人自己敲命令，或看 Agent bash | Host PTY（与 Agent bash 隔离） |
| 制品 | 生成的 md/html/图片/补丁/测试报告 | `.anvil/artifacts/` |
| 工作流 | 看板或 DAG：计划 → 执行 → 审查 | 自研编排层，底层仍是 Pi session |

### 5.3 Composer

不只是输入框，而是 **驾驶舱**：

- `@文件` / `@目录` / `@会话` / `@agent:审查者`
- `/` 触发 Pi 命令、skills、prompt templates
- 流式中支持 **Steer**（插入方向）和 **Follow-up**（结束后再做）
- Esc = `clear_queue` + `abort`，并把队列文本还回输入框（对齐 Pi RPC 语义）
- 模型、思考等级、只读/可写模式，放在输入框上方，不藏设置里

---

## 6. 技术架构

### 6.1 总览

```
┌─────────────────────────────────────────────┐
│  Renderer（Vite + React）                    │
│  只渲染 + 发意图                              │
│  WebSocket / IPC  ←  强类型协议 AnvilProtocol│
└──────────────────────▲──────────────────────┘
                       │
┌──────────────────────┴──────────────────────┐
│  Host（Node.js，工作台自研）                  │
│  - 项目管理 / 信任策略 / 密钥保险箱            │
│  - 会话目录索引（不改 Pi jsonl）               │
│  - Git / 文件搜索 / 快照 / PTY                 │
│  - 编排器：多 Agent、看板、审批队列            │
│  - Pi Runtime 监督（SDK in-process 或 sidecar）│
└───────────────▲───────────────▲──────────────┘
                │               │
     ┌──────────┴───┐     ┌─────┴──────────┐
     │ Pi SDK       │     │ 自研 Pi 扩展     │
     │ createAgent  │     │ - 审批闸门       │
     │ SessionRuntime│    │ - 子任务委派     │
     │ SessionManager│    │ - 制品登记       │
     └──────────────┘     │ - 工作区索引     │
                          └────────────────┘
```

### 6.2 为什么是「Web UI + Node Host」，而不是一上来 Electron

你当前环境已经在用 DeepSeek Harness 这种 **本机 Web GUI**。这条路迭代最快：

| 阶段 | 形态 | 原因 |
|---|---|---|
| MVP | `pnpm dev`：Host 起 HTTP+WS，浏览器打开 | 改 UI 秒级刷新，不跟 Electron 打包打架 |
| v0.2 | Tauri 或 Electron 薄壳包一层 | 只要原生托盘、文件关联、自动更新 |
| 可选 | 继续纯浏览器（localhost） | 对开发者足够，和 Cursor/DSH 同类 |

**不建议 Tauri 做 Host。** Pi SDK 是 Node/TypeScript，Host 用 Node 才能零摩擦调用 `createAgentSessionRuntime()`。Tauri/Electron 只做壳。

推荐壳（到需要打包时再选）：

- 要 Windows 体验 + 体积：Tauri 2（壳）+ Node sidecar（Host）
- 要最快对齐 OpenPi 生态：Electron（Host 可进 main）

MVP **先不要选壳**。

### 6.3 与 Pi 的两种接入方式

| 方式 | 优点 | 缺点 | 建议 |
|---|---|---|---|
| **SDK in-process** | 类型完整、事件细、无 JSONL 分帧坑 | Host 崩溃会带崩 Agent；权限边界弱 | 开发期默认 |
| **RPC sidecar** `pi --mode rpc` | 进程隔离、可杀可重启、对齐官方协议 | 要自己处理 JSONL（不能用 Node readline） | 生产默认，高风险项目强制 |

Host 抽象一个 `PiAdapter`：

```ts
interface PiAdapter {
  prompt(input: PromptInput): Promise<void>
  steer(text: string): Promise<void>
  followUp(text: string): Promise<void>
  abort(): Promise<void>
  compact(instructions?: string): Promise<void>
  navigateTree(nodeId: string): Promise<void>
  newSession(): Promise<SessionRef>
  switchSession(id: string): Promise<void>
  fork(entryId: string): Promise<SessionRef>
  subscribe(cb: (ev: NormalizedEvent) => void): () => void
  dispose(): Promise<void>
}
```

内部两个实现：`SdkAdapter`、`RpcAdapter`。UI 只认规范化事件。

### 6.4 仓库结构（pnpm monorepo）

```
anvil/
  apps/web/                 # React 工作台 UI
  apps/host/                # Node Host：HTTP/WS + Pi adapter + git/pty
  apps/desktop/             # 后期 Tauri/Electron 壳（可空着）
  packages/protocol/        # AnvilProtocol 类型，前后端共享
  packages/ui/              # 设计系统（对话气泡、工具卡、树、diff）
  packages/pi-ext-gate/     # Pi extension：权限闸门
  packages/pi-ext-delegate/ # Pi extension：子任务委派
  packages/pi-ext-artifact/ # Pi extension：制品登记
  docs/                     # 方案、RFC、开发笔记
```

技术选型（锁定，避免选型瘫痪）：

- 语言：TypeScript 5.x，全程 ESM
- 包管理：pnpm workspace
- UI：React 19 + Vite + Tailwind + shadcn/ui
- 状态：UI 用 Zustand；服务端会话真相在 Pi + Host SQLite 索引
- 协议：WebSocket + JSON，用 Zod 校验
- 测试：Vitest；Host 对 Pi 用假 adapter；关键路径再上真实 Pi
- 目标运行时：Node 22+（Pi 生态同样要求）

---

## 7. 分层设计（自研边界画清楚）

### 7.1 绝不自研

- LLM provider 适配
- tool calling loop
- session jsonl 格式、branch、compaction 算法
- extension / skill / prompt template 加载
- 模型目录刷新

### 7.2 必须自研（这才是产品）

1. **工作区与信任模型**
2. **规范化事件总线与时间旅行 UI**
3. **会话树可视化 + 多列对比**
4. **文件快照 / Diff / 部分接受**
5. **权限闸门**（Pi 没有）
6. **多 Agent 编排**（Pi 没有）
7. **工作流看板**
8. **制品库**
9. **可观测性：token、费用、延迟、失败分类**
10. **中文 UX 与命令面板**

### 7.3 用 Pi Extension 做、不要做进 Host 内核的

- 子 Agent 委派工具 `delegate_task`
- 危险命令拦截 `beforeToolCall`
- 写文件前后快照
- 网络搜索、浏览器（可后期装第三方包）
- 自定义 slash 命令（`/plan` `/review` `/ship`）

这样：即使用户离开 Anvil，只用终端 `pi`，扩展仍然可用。这是对 Pi 哲学的尊重，也是护城河——数据不锁死在我们 UI 里。

---

## 8. 数据模型

### 8.1 真相分层

| 层 | 存什么 | 存在哪 |
|---|---|---|
| Pi 真相 | 消息、树、compaction、模型 | 项目下 Pi session jsonl（不改格式） |
| Host 索引 | 会话标题、项目、标签、费用汇总、树缓存 | `%USERPROFILE%\.anvil\index.sqlite` |
| 工作区策略 | 信任、允许的工具、审批规则 | `<repo>/.anvil/settings.json` |
| 制品 | 补丁、报告、截图、导出 | `<repo>/.anvil/artifacts/` |
| 密钥 | API Key、OAuth token | OS 凭据库；开发期可降级到加密文件 |
| 角色 | persona 定义 | `~/.anvil/personas/` + 项目覆盖 |

### 8.2 工作区设置草案

```jsonc
// .anvil/settings.json
{
  "trust": "prompt",              // prompt | trusted | sandbox
  "defaultModel": "anthropic/claude-sonnet-4-6",
  "tools": {
    "read": "allow",
    "edit": "allow",
    "write": "ask",
    "bash": "ask"
  },
  "bashAllowlist": ["git status", "git diff", "pnpm test", "pnpm lint"],
  "protectedPaths": [".env", "**/*.pem", "**/*credential*"],
  "sandbox": { "mode": "none" },  // none | docker | rpc-sidecar
  "agents": {
    "architect": { "model": "…", "tools": ["read"], "skill": "architect" },
    "implementer": { "model": "…", "tools": ["read","edit","write","bash"] },
    "reviewer": { "model": "…", "tools": ["read"] }
  }
}
```

### 8.3 规范化事件（UI 只认这个）

把 Pi 的 `agent_start / message_update / tool_execution_* / turn_end` 收成：

```ts
type AnvilEvent =
  | { type: "session/replaced"; sessionId: string }
  | { type: "message/upsert"; message: UiMessage }
  | { type: "tool/start"; callId: string; name: string; args: unknown }
  | { type: "tool/update"; callId: string; partial: string }
  | { type: "tool/end"; callId: string; ok: boolean; result: unknown }
  | { type: "approval/needed"; request: ApprovalRequest }
  | { type: "usage/update"; tokens: Usage; costUsd?: number }
  | { type: "tree/changed"; root: TreeNode }
  | { type: "fs/changed"; paths: string[] }
  | { type: "agent/idle" | "agent/running" | "agent/error"; error?: string }
```

UI 做事件溯源：重连时 Host 重放快照 + 后续增量。

---

## 9. 多 Agent 编排（产品心脏）

Pi 官方跳过 subagent。这是 Anvil 最值得做的部分。

### 9.1 模型

不要一开始做「Agent 操作系统微服务」。先做 **有监督的委派**：

```
用户
  └─ 主会话（Pi session A，角色=指挥）
        ├─ delegate → 子会话 B（实现者，cwd 相同或子目录）
        ├─ delegate → 子会话 C（审查者，只读）
        └─ 汇总回复用户
```

每个子任务：

- 独立 Pi session（真实 jsonl，可单独打开）
- 有 `parentSession`（Pi RPC 已支持）
- 有目标、允许工具、超时、工作目录
- 完成后把 **摘要 + 变更文件列表** 写回父会话，而不是把整段 transcript 灌回去

### 9.2 实现路径

1. 写 Pi extension `delegate_task`
   - 工具参数：`goal`, `persona`, `cwd?`, `tools?`
   - Host 监听该工具，真正 `createAgentSession` 拉起子运行时
2. UI 底部任务托盘：运行中 / 成功 / 失败 / 等待审批
3. 后期再升级成看板：列 = 待办 / 进行 / 阻塞 / 完成，卡片 = 子会话

### 9.3 反模式

- 不要让子 Agent 再无限委派（v1 深度=1）
- 不要共享可变记忆总线（用文件和 git 当共享内存）
- 不要多个 Agent 同时写同一文件（Host 做文件锁，冲突则排队或拆分支）

---

## 10. 权限与安全（必须自研）

Pi 文档写得很清楚：它 **没有** 内置文件系统/进程/网络权限系统，默认等于启动它的用户。工作台如果不管，就是给模型 root。

### 10.1 三层闸门

1. **项目信任**
   - 第一次打开仓库：只读预览，询问是否信任
   - 不信任：禁用 bash / write / edit，只允许 read
2. **工具策略**
   - `allow` / `ask` / `deny` 按工具、按命令前缀、按路径 glob
   - 实现点：Pi `beforeToolCall`（extension 里）
   - UI：审批卡，带参数预览、风险标签
3. **进程隔离**
   - 开发：SDK in-process + 策略闸门
   - 可信项目：可保持 in-process
   - 不熟的仓库：强制 RPC sidecar；再进一步 Docker（Pi 官方有 Docker / Gondolin / OpenShell 三种模式）

### 10.2 保护规则（默认开启）

- 拒绝读取/写入：`.env*`, `**/*secret*`, `**/*.pem`, `**/id_rsa`, 浏览器 cookie 路径
- `bash` 默认 ask；allowlist 仅只读 git / 测试
- `rm -rf`、`git push`、`git reset --hard`、改远程配置：永远 ask
- Host 自身配置目录 `~/.anvil` 对 Agent 不可见，除非用户显式打开

### 10.3 密钥

- 优先复用 Pi 已有 `/login` 与环境变量，不重复造 OAuth
- Anvil 只存「工作台自己的」设置；模型密钥尽量让 Pi 管
- 若做密钥 UI：只写 OS 凭据库，Renderer 永远看不到明文

---

## 11. UX 细节（决定好不好用）

### 11.1 工具卡片

每条 tool call 是一张可折叠卡：

- 标题：`edit src/app.ts` / `bash pnpm test`
- 状态：排队 / 审批 / 运行 / 成功 / 失败
- 展开：参数、stdout、diff hunk
- 操作：允许一次 / 允许本会话 / 拒绝 / 编辑后再跑（v1 可只做允许/拒绝）

### 11.2 会话树

- 横向树，节点=一轮
- 单击高亮，双击切到该节点对话
- 右键：Fork / 从这里继续 / 克隆分支 / 复制摘要
- 失败节点标红，压缩节点标灰
- 这是对 Pi 已有 branching 的可视化，不发明新格式

### 11.3 Diff

- Agent 写文件前后由 extension 打快照
- 同时显示 git diff（已跟踪）和 snapshot diff（未跟踪）
- v1 整文件接受/还原；v0.3 再做 hunk 级

### 11.4 命令面板（Ctrl+K）

统一搜：命令、会话、文件、角色、模型。这是专家用户的主入口。

### 11.5 空状态

新用户打开 Anvil：

1. 选择文件夹
2. 检测是否已有 Pi sessions
3. 选模型（没有密钥则跳转 Pi 登录说明）
4. 给三张启动卡片：「解释这个仓库」「修这个 bug」「从树里恢复上次会话」

---

## 12. 里程碑

### Phase 0 — 立项与骨架（约 3–5 天）

- 本仓库初始化 pnpm monorepo
- `apps/host` 能启动，健康检查
- `apps/web` 能连上 WS，显示心跳
- `PiAdapter` 接口 + 假实现（不接真模型也能点通 UI）
- 文档：架构图、协议草案

**完成标准：** 浏览器打开就能看到假对话流和假工具卡。

### Phase 1 — MVP 可用结对（约 2–3 周）

范围（宁少勿滥）：

1. 打开本地文件夹作为工作区
2. 用 SDK 拉起一个 Pi session
3. 对话流 + 流式文本 + 工具卡
4. 模型选择（复用 Pi 已登录 providers）
5. 会话列表（扫描 Pi 的 session 目录，resume / new）
6. Steer / Follow-up / Abort
7. 基础审批：bash 和写保护路径要 ask
8. 简单文件树 + 打开只读预览
9. 状态栏：model / tokens / cwd

**非目标：** 多 Agent、看板、桌面壳、hunk 级 diff。

**完成标准：** 你能用 Anvil 在本机仓库里让 Pi 改代码，过程可看、可停、可恢复会话。

### Phase 2 — 树与制品（约 2 周）

- 会话树可视化 + fork / navigateTree
- 写文件快照 + Diff 视图
- 终端面板（人用 PTY，和 Agent bash 分开）
- 压缩（compact）按钮与摘要展示
- 中文命令面板

**完成标准：** 同一问题能分叉两条方案并排看（至少能快速切换）。

### Phase 3 — 多 Agent（约 2–3 周）

- `delegate_task` extension
- 子会话监督、文件锁、摘要回写
- 任务托盘
- 三个内置角色：架构师 / 实现者 / 审查者
- 深度限制、超时、花费上限

**完成标准：** 「给这个仓库加登录」能拆成 2–3 个子任务并行，主会话给出总结果。

### Phase 4 — 工作流与产品化（约 3 周）

- 看板（卡片=子会话）
- Docker/RPC 沙箱策略
- Tauri/Electron 壳、托盘、自动更新
- 费用报表、会话导出/分享（可对接 pi-share-hf 思路）
- Windows 安装包

### 总工期（单人全职）

- 能自己天天用：5–8 周（Phase 0–2）
- 有多 Agent 特色：8–11 周
- 可给别人装：12–14 周

一人项目必须砍范围。**Phase 1 结束前不要碰桌面壳和看板。**

---

## 13. Phase 1 模块任务拆解

### Host

- [ ] workspace open/close，记录最近项目
- [ ] 信任提示状态机
- [ ] Pi SDK 生命周期：cwd 变化要重建 `AgentSessionRuntime`
- [ ] 事件规范化 + 快照（供 UI 重连）
- [ ] session 文件索引
- [ ] 审批队列 API
- [ ] 静态文件服务 + WS

### Web

- [ ] 三栏布局
- [ ] 消息列表虚拟滚动
- [ ] 工具卡
- [ ] Composer（@ 文件、/ 命令以后再做，v1 先纯文本）
- [ ] 会话侧栏
- [ ] 审批模态
- [ ] 断线重连

### Extension

- [ ] `anvil-gate`：`beforeToolCall` 把 bash/write 转到 Host 审批
- [ ] `anvil-snap`：write/edit 前后复制到 artifacts/snapshots

### 协议（先定这 12 个命令）

`workspace.open` `session.list` `session.new` `session.resume`  
`agent.prompt` `agent.steer` `agent.followUp` `agent.abort`  
`approval.respond` `model.list` `model.set` `fs.tree`

---

## 14. 质量与工程纪律

- Host 所有入口 Zod 校验（学 OpenPi：Renderer 不可信）
- 禁止 Renderer 直接 `fetch` 本地文件
- 每个 adapter 方法有超时
- 不在日志里打 prompt 全文和密钥
- `pnpm check`：typecheck + lint
- 对 Pi 版本 **钉死**，升级当专项（Pi 迭代快，SDK 会变）
- 贡献/开发约定写成 `AGENTS.md`，让 Anvil 自己也能改自己

---

## 15. 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| Pi SDK 快速破坏性更新 | 工作台跟不上 | 钉版本；adapter 隔离；升级 checklist |
| 权限没做好 | 模型毁掉仓库或泄密 | Phase 1 就做闸门；默认 ask bash |
| 做成聊天套壳 | 没有差异化 | Phase 2 必须上树；Phase 3 必须上委派 |
| Electron 过早 | 浪费周数 | MVP 只用浏览器 |
| 多 Agent 写冲突 | 代码损坏 | 文件锁 + 深度 1 + 子目录委派 |
| Windows 终端/PTY | 体验差 | Phase 1 不做终端；Phase 2 用 node-pty |
| 自己不用 | 产品假 | 你的日常开发必须切到 Anvil 做 dogfood |

---

## 16. 成功标准

**四周后（个人 dogfood）：**

- 关闭终端 Pi，日常改这个仓库都在 Anvil 里完成
- 至少一次用分叉对比两种实现
- 没有出现「Agent 偷偷跑了危险命令」

**三个月后（可演示）：**

- 主 Agent 拆任务，两个子 Agent 并行，审查者只读提意见
- 外人克隆仓库，`pnpm i && pnpm dev`，10 分钟内跑通一次真实会话
- 会话离开 Anvil，用官方 `pi` 仍能 resume（格式兼容是硬指标）

---

## 17. 建议立刻拍板的 5 个决定

1. **产品名**：Anvil / Loom / 工坊 / 你指定
2. **形态**：同意 MVP = 本机 Web + Node Host（推荐）
3. **接入**：开发 SDK、发布 RPC sidecar（推荐）
4. **第一刀差异化**：会话树 还是 多 Agent？推荐 **先树后 Agent**（树复用 Pi 已有能力，Agent 要自研）
5. **模型**：你日常用哪家（DeepSeek / Anthropic / 本地 llama.cpp）——Host 登录流程跟着它做

---

## 18. 下一步（你一确认我就开工）

按推荐路径，下一步不是继续写文档，而是：

1. 初始化 pnpm monorepo
2. 拉起 Host + Web 空壳
3. 接上假 `PiAdapter`，把对话 UI 跑通
4. 再接真实 `@earendil-works/pi-coding-agent`

如果你认可本方案，直接说：「按 Phase 0 开工」，并补上上面 5 个决定（或让我用推荐值）。
