# Phase 1 dogfood 记录

用 Anvil 改 Anvil 时记下摩擦。可脱敏，不要贴密钥和完整 prompt。

## 已完成的骨架能力

- 粘贴路径打开工作区，最近项目写入 `~/.anvil/config.json`
- 未信任默认拒绝 bash/write；信任后 bash 弹审批
- 会话 new / list / resume，id 为 Pi jsonl 路径
- 刷新浏览器会收到 snapshot
- Esc / 中止会 abort，并尝试 `clearQueue`

## 摩擦点（待补）

1. 浏览器没有系统文件对话框，只能粘贴路径。桌面壳可用系统文件夹对话框。
2. 真 Pi 需要本机已配置模型；没密钥时 Host 应显示中文空状态而不是英文 stack。
3. 工具卡输出是字符串化结果，复杂 tool result 阅读体验一般。

离线闭环：假循环在打开工作区后会把 user/assistant 写入 Pi jsonl；`session.resume` 会把消息灌回 UI。真模型改 README 的 dogfood 仍需密钥。
