import { useUiStore } from "../store.ts";

export function UsageExport() {
  const { usage, sessionId, cwd } = useUiStore();
  const copy = async () => {
    const text = [
      "Anvil 用量摘要（本地，未上传）",
      `cwd: ${cwd ?? "-"}`,
      `session: ${sessionId ?? "-"}`,
      `input: ${usage.inputTokens}`,
      `output: ${usage.outputTokens}`,
      `usd: ${(usage.costUsd ?? 0).toFixed(4)}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
  };
  return (
    <button type="button" onClick={copy} className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]">
      复制本周 tokens
    </button>
  );
}
