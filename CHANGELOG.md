# Changelog

## 0.0.0 — 开发演示版

- Phase 0–3：假循环、真 SDK 结对、会话树、Diff、委派托盘。
- Phase 4：看板、设置、RPC sidecar 开关、安全回归测试、`anvil.cmd`。
- 子任务与假循环新建会话会写出官方 Pi jsonl（需 assistant 消息才落盘）。
- 设置页的 bash 白名单接到闸门；Docker 探测；Electron 薄壳可选。
- 假循环 prompt / resume / fork 会写出并回放官方 Pi jsonl。
- 子任务各自跑独立 FakePiAdapter，只读 persona 不弹 bash 审批。
- 立项草案清单已冻结，执行进度以开发计划和 README 为准。
- 检查器制品列表 + Composer `/compact` `/new` `/abort`。
- 假循环允许 bash 后把演示 Diff 写入 ArtifactStore，制品面板能列出来。
- 子任务 bash 审批走主队列并标明来源；费用汇总；失败分类（锁冲突/用户拒绝等）。
- `usage.export` 按天汇总本机 tokens；RPC sidecar 命令失败后最多重启 3 次。
- 设置页默认模型接到 adapter；Electron 关窗口进托盘。
- `ANVIL_PI_MODE=auto`：未信任默认 RPC。SDK `message_update` 映射有夹具测试。
- Composer `@` 选中文件后插入相对路径；`/health` 带本会话 tokens。
- Diff 优先 `git diff`，没有 git 再用快照；假循环 compact 写摘要并落 jsonl。
- 看板卡片可拖到其他列；Composer `@agent:审查者 …` 直接委派。
- 启动时写入 `~/.anvil/personas/` 三份默认角色（不覆盖已改文件）；文件树可上一级。
- 打开工作区合并项目 `.anvil/settings.json`；设置页保存会写回该文件。
- 设置页可选新工作区默认信任；Ctrl+K 预览文件，Composer `@` 才插入路径。
- 大于 2MB 的快照只记 sha256；`/health` 带 RPC sidecar 重启次数。
- 子任务 `timeoutSec` / `maxUsd` 真正生效；检查器压缩带保留指令。
- 助手消息转义后渲染粗体/行内代码；工具卡显示已用时并可展开全部输出。
- 审批超时视为拒绝并显示倒计时；Esc / 中止把 steer、follow-up 队列还回输入框。
- 会话树右键：Fork / 从这里继续 / 复制节点 id；状态栏显示 cache tokens；长错误可折叠详情。
- 刷新 snapshot 带工具已用时；闲时把卡住的 running 收成结束，避免永久转圈。
- 已知问题见 README。
