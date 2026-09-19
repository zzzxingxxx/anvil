import { BookOpen, Copy, RefreshCw, Sparkles, Pencil, Trash2, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";
import { ConfigPageShell } from "./ConfigPageShell.tsx";

type SkillInfo = {
  name: string;
  description: string;
  filePath: string;
  source: string;
  body?: string;
  editable?: boolean;
};

export function SkillsPage() {
  const cwd = useUiStore((state) => state.cwd);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editBody, setEditBody] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.request("skill.list", {});
      const payload = response.payload as { skills?: SkillInfo[] };
      setSkills(payload.skills ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cwd]);

  const createFromPrompt = async () => {
    const text = prompt.trim();
    if (!text || saving) return;
    if (!cwd) {
      useUiStore.setState({ lastError: "先打开工作区，再创建项目 Skill。" });
      return;
    }
    setSaving(true);
    try {
      const response = await client.request("skill.create", { prompt: text, scope: "project" });
      const payload = response.payload as { skill?: SkillInfo; skills?: SkillInfo[] };
      setSkills(payload.skills ?? []);
      setPrompt("");
      setNotice(`已创建 /skill:${payload.skill?.name ?? ""}。`);
    } catch (caught) {
      useUiStore.setState({ lastError: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (skill: SkillInfo) => {
    setEditing(skill.filePath);
    setEditDescription(skill.description);
    setEditBody(skill.body ?? "");
  };

  const saveEdit = async (filePath: string) => {
    if (!editDescription.trim()) return;
    try {
      const response = await client.request("skill.update", {
        filePath,
        description: editDescription.trim(),
        body: editBody,
      });
      const payload = response.payload as { skills?: SkillInfo[] };
      setSkills(payload.skills ?? []);
      setEditing(null);
      setNotice("已保存 SKILL.md。");
    } catch (caught) {
      useUiStore.setState({ lastError: caught instanceof Error ? caught.message : String(caught) });
    }
  };

  const removeSkill = async (skill: SkillInfo) => {
    if (!window.confirm(`删除 /skill:${skill.name}？文件会从磁盘移除。`)) return;
    try {
      const response = await client.request("skill.delete", { filePath: skill.filePath });
      const payload = response.payload as { skills?: SkillInfo[] };
      setSkills(payload.skills ?? []);
      setNotice(`已删除 /skill:${skill.name}。`);
    } catch (caught) {
      useUiStore.setState({ lastError: caught instanceof Error ? caught.message : String(caught) });
    }
  };

  return (
    <ConfigPageShell
      icon={BookOpen}
      title="Skill"
      detail="一句话创建。用户和项目目录里的 SKILL.md 可以在这里改或删。"
      badge={loading ? "加载中" : `${skills.length} 个`}
      notice={notice}
      error={error}
    >
      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="text-sm font-semibold text-[#1f1e1d]">添加</h2>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：审查当前 git diff，按严重程度列出问题和改法"
          className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs outline-none focus:bg-white"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              useUiStore.setState({
                restoredDraft: prompt.trim()
                  ? `帮我创建一个 Skill：${prompt.trim()}`
                  : "根据当前项目帮我创建一个最有用的 Skill。",
                activeTab: "chat",
              })
            }
            className="px-3 py-2 rounded-lg border border-[#00000014] text-xs text-[#4f4e4a] hover:bg-[#faf9f5] flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            让 AI 添加
          </button>
          <button
            type="button"
            disabled={saving || !prompt.trim() || !cwd}
            onClick={() => void createFromPrompt()}
            className="px-3 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs font-medium disabled:opacity-40"
          >
            {saving ? "正在创建…" : "创建"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1f1e1d]">已添加</h2>
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
          <p className="text-[11px] text-[#7e7d77]">还没有。写一句话点创建，或让 AI 生成。</p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div key={`${skill.source}-${skill.filePath}`} className="rounded-xl border border-[#0000000c] bg-[#faf9f5] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium font-mono text-[#1f1e1d]">/skill:{skill.name}</div>
                    {editing === skill.filePath ? null : (
                      <p className="text-[11px] text-[#4f4e4a] mt-1">{skill.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#7e7d77] shrink-0">{skill.source === "project" ? "项目" : "用户"}</span>
                </div>
                {editing === skill.filePath ? (
                  <div className="space-y-2">
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-[#00000014] bg-white text-xs outline-none"
                    />
                    <textarea
                      rows={6}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-[#00000014] bg-white text-[11px] font-mono outline-none"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void saveEdit(skill.filePath)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#1f1e1d] text-white text-[10.5px]"
                      >
                        <Check className="w-3 h-3" />
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                      >
                        <X className="w-3 h-3" />
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(`/skill:${skill.name}`).then(
                        () => setNotice(`已复制 /skill:${skill.name}`),
                        () => useUiStore.setState({ restoredDraft: `/skill:${skill.name} `, activeTab: "chat" }),
                      )}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                    >
                      <Copy className="w-3 h-3" />
                      复制
                    </button>
                    <button
                      type="button"
                      onClick={() => useUiStore.setState({ restoredDraft: `/skill:${skill.name} `, activeTab: "chat" })}
                      className="px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                    >
                      插入对话
                    </button>
                    {skill.editable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(skill)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                        >
                          <Pencil className="w-3 h-3" />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeSkill(skill)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </ConfigPageShell>
  );
}
