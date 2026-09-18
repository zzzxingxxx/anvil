import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";

export async function pickWorkspaceFolder(): Promise<string | null> {
  const native = window.anvilDesktop;
  if (native && typeof native.pickFolder === "function") {
    try {
      const picked = await native.pickFolder();
      return picked ? picked : null;
    } catch (error) {
      console.warn("native pickFolder error:", error);
    }
  }

  try {
    const response = await client.request("workspace.pickFolder", {});
    const payload = response.payload as { ok?: boolean; path?: string | null };
    return payload.path ?? null;
  } catch (error) {
    useUiStore.setState({
      lastError: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function openWorkspace(path: string): Promise<boolean> {
  const trimmed = path.trim();
  if (!trimmed) {
    return false;
  }
  try {
    await client.request("workspace.open", { path: trimmed });
    return true;
  } catch (error) {
    useUiStore.setState({
      lastError: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function pickAndOpenWorkspace(): Promise<string | null> {
  const picked = await pickWorkspaceFolder();
  if (picked) {
    const ok = await openWorkspace(picked);
    if (ok) {
      return picked;
    }
  }
  return null;
}
