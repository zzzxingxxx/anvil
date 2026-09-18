# Phase 2 dogfood

假循环即可验证：发一条消息 → 右侧出现会话树和演示 Diff → 点节点切换 → Fork 出新会话。

离线闭环：Fork 会新建一份带 parentSession 的 jsonl。

真模型分叉（2026-09-18）：

1. 在 Anvil SDK 真改文件会话的叶节点 `fork`。
2. 新 jsonl 独立存在，父会话文件不被覆盖。
3. 分叉会话继续一轮，回复 `FORK_OK`，未再写文件。

摩擦：

1. 浏览器版树是缩进列表，不是横向图形树（计划允许 v1 用列表）。
2. 假循环 Diff 写在 `.anvil/demo-diff.txt`，并落到 `.anvil/artifacts/snapshots`；不会改 README。真 SDK 的 write/edit 走同一套 ArtifactStore。
3. Windows 上 node-pty 按计划减载，人用终端推迟。
4. 这次真分叉是「同一问题两条会话」而不是 UI 里人工点选 A/B；路径已通。
