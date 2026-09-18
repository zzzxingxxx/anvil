# Phase 3 dogfood

任务：「给 Host 加一个 `/metrics` 健康扩展字段」。

假编排即可验证：

1. 信任工作区后点托盘「新子任务」或发 `task.delegate`。
2. 两个只读角色可并行完成，摘要写回主对话。
3. 未信任派出 implementer 被拒。
4. 同一文件第二次 write 报锁冲突。

子任务现在会 `SessionManager.create` 写出 jsonl（带 parentSession），并各自跑一轮独立 FakePiAdapter（只读 persona 不 bash）。侧栏可 resume。

真模型拆前端文案 + Host 实现 + 审查还没跑（本机无密钥）。
