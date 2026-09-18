import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function UsageExport() {
  const copy = async () => {
    try {
      const response = await client.request("usage.export", {});
      const payload = response.payload as { text?: string };
      const text = payload.text ?? "Anvil 用量摘要（本地，未上传）";
      await navigator.clipboard.writeText(text);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return (
    <button type="button" onClick={copy} className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]">
      复制本周 tokens
    </button>
  );
}
