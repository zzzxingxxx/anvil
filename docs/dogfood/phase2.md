# Phase 2 dogfood

假循环即可验证：发一条消息 → 右侧出现会话树和演示 Diff → 点节点切换 → Fork 出新会话。

离线闭环：Fork 会新建一份带 parentSession 的 jsonl。真模型分叉对比（需密钥）还没跑。摩擦：

1. 浏览器版树是缩进列表，不是横向图形树（计划允许 v1 用列表）。
2. 假循环 Diff 写在 `.anvil/demo-diff.txt`，不会改 README；真 SDK 的 write/edit 会快照到 `.anvil/artifacts`。
3. Windows 上 node-pty 按计划减载，人用终端推迟。
