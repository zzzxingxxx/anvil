# 冒烟清单

每过一个阶段门手动过一遍。真模型步骤标了「需密钥」。

## Phase 1

1. `pnpm dev` → http://127.0.0.1:5173 能开。
2. 左侧粘贴本仓库路径，状态栏显示 cwd。
3. 未信任发「列出文件」：bash/write 被拒。
4. 顶栏切到信任 → 假循环弹出审批 → 允许一次有输出；拒绝则工具失败、Host 不崩。
5. 新建两条会话，切换后消息不串。
6. 刷新浏览器：snapshot 把对话和工具卡推回来。已结束的工具不再转圈，已用时还在。
7. 运行中按 Esc：立刻停；若已点「插入方向 / 结束后做」，文本还回输入框。审批卡显示倒计时，超时视为拒绝。
8. `pnpm check && pnpm test` 绿。
9. **需密钥：** 真模型改一个 md；官方 `pi` resume 同一 jsonl。

当前本机：已装 `pi`，`~/.pi/agent` 存在。`pnpm --filter host compat` 用 SessionManager 打开了 5 个真实 jsonl（version 3）。自定义 provider 标 ready，但 `pi -p` 一轮全部失败（401/400/503/流中断）。第 9 步（真改文件）未跑通。

## Phase 2

1. 假会话里能看到树节点，单击历史节点后刷新会只显示该路径消息。右键可 Fork / 从这里继续 / 复制节点 id。运行中切换分支会提示「等当前轮结束」。
2. 对同一用户消息 Fork 两次，两条分支互不覆盖。
3. 假循环结束后 Diff 面板出现 `.anvil/demo-diff.txt`；点还原走 `artifact.restore`（不会改 README）。有 git 时优先显示 `git diff`。
4. 检查器点「压缩」后树节点标 compressed，对话里出现摘要。
5. `Ctrl+K` 打开即列出 `/compact` `/new` `/abort` 和最近会话，方向键/回车可选中；也能搜到 `docs/开发计划.md` 并预览。Composer 输入 `@开发计划` 选中后路径插入输入框。设置页可改新工作区默认信任。运行中点压缩、新建或切换会话会提示「等当前轮结束」。
6. 人用终端（node-pty）按计划减载，本阶段不做。
7. 检查器制品面板能列出快照；Composer 输入 `/` 能看到 compact/new/abort。超过 24 行的助手消息可折叠；工具卡显示已用时，长输出可展开全部。

## Phase 3

1. 信任后委派 2 个只读子任务，托盘同时更新，显示耗时；完成后出现横幅，不打断输入框。
2. 子任务不能再委派。
3. 两个实现者抢同一文件，第二个失败。
4. 未信任不能派出可写子 Agent。`maxUsd: 0` 的子任务失败原因为「超费」。
5. 子任务卡片能 resume 到一份 `.jsonl`。
6. `pnpm --filter host compat` 能打开本机最多 5 个真实 session。
7. Host 启动后 `~/.anvil/personas/` 有 architect/implementer/reviewer.md；改过的文件不会被覆盖。
8. 文件树进入子目录后能点「上一级」，不会走出工作区。

## Phase 4

1. 顶栏切到看板，委派后卡片出现在「进行/完成」。可拖到其他列，只改 Host 元数据。
2. 设置页保存 bash 白名单，保存后有成功提示。已打开工作区时写入项目 `.anvil/settings.json`；下次打开该仓库会覆盖全局。底栏出错时显示「出错」而不是「就绪」。
3. `anvil.cmd` 或 `pnpm start` 打开 http://127.0.0.1:5173。
4. `ANVIL_PI_MODE=rpc` 时 Host 日志显示 adapter rpc（需本机 pi）。`auto` 且信任默认不是 trusted 时同样走 RPC。RPC 下新建/恢复/分叉/压缩会回灌 sidecar 消息、会话树和用量；一轮对话会推 message/upsert 和工具卡。写/改文件会进 Diff。左侧会话列表来自 `SessionManager.list`。打开工作区会恢复最近一次官方 Pi 会话（没有才新建）。RPC 顶栏徽章提示不走 Anvil 闸门。单击会话树不应把对话滤空。
5. 设置页把 bash 设为白名单后，名单外的命令会弹审批。
6. 没有 Docker 时设置页只显示说明。
7. `pnpm --filter desktop dev` 能打开壳；关窗口进托盘，托盘「退出」才结束。浏览器版继续粘贴路径。
8. 底栏「复制本周 tokens」得到本地摘要，不含密钥；有 cache 时含 cacheRead/cacheWrite。复制成功后按钮变成「已复制」。
9. `/health.metrics.rpcRestarts` 在 SDK/假循环为 0；RPC sidecar 崩溃后递增，最多 3。`/health.metrics` 含 cacheReadTokens / cacheWriteTokens。
