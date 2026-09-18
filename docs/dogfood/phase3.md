# Phase 3 dogfood

任务：「给 Host 加一个 `/metrics` 健康扩展字段」。

假编排即可验证：

1. 信任工作区后点托盘「新子任务」或发 `task.delegate`。
2. 两个只读角色可并行完成，摘要写回主对话。
3. 未信任派出 implementer 被拒。
4. 同一文件第二次 write 报锁冲突。

Composer 输入 `@agent:审查者 看这段 diff` 会直接 `task.delegate`，不再只改提示词。子任务会 `SessionManager.create` 写出 jsonl（带 parentSession）。假循环/RPC 父会话各自跑独立 FakePiAdapter（只读 persona 不 bash）；SDK 父会话各自跑独立 SdkPiAdapter，审批卡带 taskId。可写子任务的 bash 审批会标「来自子任务」，拒绝后只有该子任务失败。父+子费用会滚到检查器。侧栏可 resume。看板可拖拽换列。

真模型拆前端文案 + Host 实现 + 审查还没跑（本机无密钥）。
