import { BookOpen, Copy, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";
import { ConfigPageShell } from "./ConfigPageShell.tsx";

type SkillInfo = {
  name: string;
  description: string;
  filePath: string;
  source: string;
  disableModelInvocation?: boolean;
};

export function SkillsPage() {
  const cwd = useUiStore((state) => state.cwd);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.request("skill.list", {});
      const payload = response.payload as { skills?: SkillInfo[] };
      setSkills(payload.skills ?? []);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cwd]);

  const copyCommand = async (name: string) => {
    const command = `/skill:${name}`;
    try {
      await navigator.clipboard.writeText(command);
      setNotice(`已复制 ${command}，粘贴到对话即可注入。`);
    } catch {
      useUiStore.setState({ restoredDraft: `${command} `, activeTab: "chat" });
      setNotice(`已插入 ${command} 到对话输入。`);
    }
  };

  const useInChat = (name: string) => {
    useUiStore.setState({ restoredDraft: `/skill:${name} `, activeTab: "chat" });
  };

  return (
    <ConfigPageShell
      icon={BookOpen}
      title="Skill"
      detail="读取 ~/.pi/agent/skills 与项目 .pi/skills。输入 /skill:名称 会把 SKILL.md 注入本轮提示。"
      badge={loading ? "加载中" : `${skills.length} 个`}
      notice={notice}
      error={error}
    >
      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1f1e1d]">已发现的 Skill</h2>
            <p className="text-[11px] text-[#7e7d77] mt-1">
              在用户目录或当前工程的 skills 文件夹放入 SKILL.md 后点刷新。
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#5e5c54] hover:bg-[#faf9f5] disabled:opacity-40"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>
        {skills.length === 0 ? (
          <p className="text-[11px] text-[#7e7d77]">
            还没有 Skill。放好文件后刷新本页，或在对话里直接输入 /skill:名称。
          </p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div key={`${skill.source}-${skill.filePath}`} className="rounded-xl border border-[#0000000c] bg-[#faf9f5] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#1f1e1d] font-mono">/skill:{skill.name}</div>
                    <p className="text-[11px] text-[#4f4e4a] mt-1">{skill.description}</p>
                    <p className="text-[10px] font-mono text-[#abaaa2] truncate mt-1" title={skill.filePath}>
                      {skill.filePath}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#7e7d77] shrink-0">
                    {skill.source === "project" ? "项目" : "用户"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void copyCommand(skill.name)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                  >
                    <Copy className="w-3 h-3" />
                    复制命令
                  </button>
                  <button
                    type="button"
                    onClick={() => useInChat(skill.name)}
                    className="px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                  >
                    插入对话
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ConfigPageShell>
  );
}
