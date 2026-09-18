# 冒烟清单

每过一个阶段门手动过一遍。真模型步骤标了「需密钥」。

## Phase 1

1. `pnpm dev` → http://127.0.0.1:5173 能开。
2. 左侧粘贴本仓库路径，状态栏显示 cwd。
3. 未信任发「列出文件」：bash/write 被拒。
4. 顶栏切到信任 → 假循环弹出审批 → 允许一次有输出；拒绝则工具失败、Host 不崩。
5. 新建两条会话，切换后消息不串。
6. 刷新浏览器：snapshot 把对话和工具卡推回来。
7. 运行中按 Esc：立刻停。
8. `pnpm check && pnpm test` 绿。
9. **需密钥：** 真模型改一个 md；官方 `pi` resume 同一 jsonl。

当前本机：已装 `pi`，`~/.pi/agent` 存在。`pnpm --filter host compat` 用 SessionManager 打开了 5 个真实 jsonl（version 3）。环境里没有模型密钥，第 9 步（真改文件）未跑通。

## Phase 2

1. 假会话里能看到树节点，单击历史节点后刷新会只显示该路径消息。
2. 对同一用户消息 Fork 两次，两条分支互不覆盖。
3. 假循环结束后 Diff 面板出现 `.anvil/demo-diff.txt`；点还原走 `artifact.restore`（不会改 README）。
4. `Ctrl+K` 能搜到 `docs/开发计划.md`。
5. 人用终端（node-pty）按计划减载，本阶段不做。

## Phase 3

1. 信任后委派 2 个只读子任务，托盘同时更新。
2. 子任务不能再委派。
3. 两个实现者抢同一文件，第二个失败。
4. 未信任不能派出可写子 Agent。
5. 子任务卡片能 resume 到一份 `.jsonl`。
6. `pnpm --filter host compat` 能打开本机最多 5 个真实 session。

## Phase 4

1. 顶栏切到看板，委派后卡片出现在「进行/完成」。
2. 设置页保存 bash 白名单。
3. `anvil.cmd` 或 `pnpm start` 打开 http://127.0.0.1:5173。
4. `ANVIL_PI_MODE=rpc` 时 Host 日志显示 adapter rpc（需本机 pi）。
5. 设置页把 bash 设为白名单后，名单外的命令会弹审批。
6. 没有 Docker 时设置页只显示说明。
7. `pnpm --filter desktop dev` 能打开壳；浏览器版继续粘贴路径。
