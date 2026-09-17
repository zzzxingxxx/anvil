# 文件锁（Phase 3）

Host 维护 `normalizedPath → taskId`。子任务在 `write` / `edit` 时抢锁，任务结束释放。

- 路径相对工作区，统一 `/`，大小写按 Windows 不敏感。
- 第二个任务写同一文件：工具失败，文案「文件被任务 X 锁定」。
- 锁不进 Pi jsonl，只活在 Host 内存。
- 未信任仓库禁止派出可写子会话（implementer）。
