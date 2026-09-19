import { BookOpen, Copy, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function SkillsPage() {
  const cwd = useUiStore((state) => state.cwd);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("review-diff");
  const [description, setDescription] = useState("审查当前 git diff，列出风险和修改建议");
  const [body, setBody] = useState("先看 git diff 和相关文件，再按严重程度列出问题。最后给出可执行的修改建议。");
  const [scope, setScope] = useState<"project" | "user">("project");

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

  const preview = useMemo(() => {
    const safeName = NAME_PATTERN.test(name.trim()) ? name.trim() : "your-skill";
    return `---
name: ${safeName}
description: ${description.trim() || "一句话说明这个 Skill 做什么"}
---

${body.trim() || "按 description 执行。"}
`;
  }, [name, description, body]);

  const nameOk = NAME_PATTERN.test(name.trim());
  const canCreate = nameOk && Boolean(description.trim()) && !saving && (scope === "user" || Boolean(cwd));
  const savePath =
    scope === "project"
      ? cwd
        ? `${cwd.replace(/[\\/]+$/, "")}/.pi/skills/${name.trim() || "名称"}/SKILL.md`
        : "先打开工作区，再创建项目 Skill"
      : `~/.pi/agent/skills/${name.trim() || "名称"}/SKILL.md`;

  const create = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      const response = await client.request("skill.create", {
        name: name.trim(),
        description: description.trim(),
        body: body.trim() || undefined,
        scope,
      });
      const payload = response.payload as { skill?: SkillInfo; skills?: SkillInfo[] };
      setSkills(payload.skills ?? []);
      setNotice(`已写入 ${payload.skill?.filePath ?? "SKILL.md"}。对话输入 /skill:${payload.skill?.name ?? name.trim()} 即可注入。`);
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      setSaving(false);
    }
  };

  const copyCommand = async (skillName: string) => {
    const command = `/skill:${skillName}`;
    try {
      await navigator.clipboard.writeText(command);
      setNotice(`已复制 ${command}，粘贴到对话即可注入本轮提示。`);
    } catch {
      useUiStore.setState({ restoredDraft: `${command} `, activeTab: "chat" });
      setNotice(`已插入 ${command} 到对话输入。`);
    }
  };

  const useInChat = (skillName: string) => {
    useUiStore.setState({ restoredDraft: `/skill:${skillName} `, activeTab: "chat" });
  };

  return (
    <ConfigPageShell
      icon={BookOpen}
      title="Skill"
      detail="Skill 是一份 SKILL.md。添加后，在对话输入 /skill:名称 会把全文注入本轮提示。"
      badge={loading ? "加载中" : `${skills.length} 个`}
      notice={notice}
      error={error}
    >
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <li className="rounded-xl border border-[#0000000c] bg-white p-3">
          <div className="font-medium text-[#1f1e1d]">1. 起一个短名</div>
          <p className="text-[#7e7d77] mt-1">只能小写字母、数字、连字符。这就是后面要用的 /skill:名称。</p>
        </li>
        <li className="rounded-xl border border-[#0000000c] bg-white p-3">
          <div className="font-medium text-[#1f1e1d]">2. 写说明和正文</div>
          <p className="text-[#7e7d77] mt-1">说明给 Agent 看「什么时候用」；正文是真正要执行的步骤。</p>
        </li>
        <li className="rounded-xl border border-[#0000000c] bg-white p-3">
          <div className="font-medium text-[#1f1e1d]">3. 在对话里调用</div>
          <p className="text-[#7e7d77] mt-1">输入 /skill:名称，后面可以跟这次的具体问题。</p>
        </li>
      </ol>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1f1e1d]">添加一个 Skill</h2>
          <p className="text-[11px] text-[#7e7d77] mt-1">保存后 Host 会写出 SKILL.md。官方 pi 也能读同一份文件。</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10.5px] text-[#7e7d77]">
              名称 <span className="text-rose-500">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(slugify(e.target.value) || e.target.value.toLowerCase())}
              placeholder="review-diff"
              className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs font-mono outline-none focus:bg-white"
            />
            <span className={`text-[10px] ${nameOk ? "text-[#7e7d77]" : "text-rose-700"}`}>
              {nameOk ? `对话命令：/skill:${name.trim()}` : "只能用 a-z、0-9 和连字符，例如 review-diff"}
            </span>
          </label>
          <fieldset className="space-y-1">
            <legend className="text-[10.5px] text-[#7e7d77]">保存位置</legend>
            <div className="flex gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-[#4f4e4a] cursor-pointer">
                <input
                  type="radio"
                  name="skill-scope"
                  checked={scope === "project"}
                  onChange={() => setScope("project")}
                  className="accent-[#1f1e1d]"
                />
                当前项目
              </label>
              <label className="flex items-center gap-2 text-xs text-[#4f4e4a] cursor-pointer">
                <input
                  type="radio"
                  name="skill-scope"
                  checked={scope === "user"}
                  onChange={() => setScope("user")}
                  className="accent-[#1f1e1d]"
                />
                本机用户
              </label>
            </div>
            <p className="text-[10px] font-mono text-[#abaaa2] break-all">{savePath}</p>
            {scope === "project" && !cwd ? (
              <p className="text-[10px] text-rose-700">还没打开工作区，项目 Skill 无法落盘。</p>
            ) : null}
          </fieldset>
        </div>

        <label className="space-y-1 block">
          <span className="text-[10.5px] text-[#7e7d77]">
            一句话说明 <span className="text-rose-500">*</span>
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="审查当前 git diff，列出风险和修改建议"
            className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs outline-none focus:bg-white"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[10.5px] text-[#7e7d77]">正文（写入 SKILL.md 的步骤）</span>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs outline-none focus:bg-white font-mono"
          />
        </label>

        <div className="rounded-xl bg-[#faf9f5] border border-[#0000000c] px-3 py-2">
          <div className="text-[10.5px] text-[#7e7d77] mb-1">将写入的文件预览</div>
          <pre className="text-[10.5px] font-mono text-[#1f1e1d] whitespace-pre-wrap">{preview}</pre>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => void create()}
            className="px-3 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs font-medium disabled:opacity-40"
          >
            {saving ? "正在写入…" : "创建 SKILL.md"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1f1e1d]">已发现的 Skill</h2>
            <p className="text-[11px] text-[#7e7d77] mt-1">包含本页创建的，以及你手动放到 skills 目录里的文件。</p>
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
          <p className="text-[11px] text-[#7e7d77]">还没有 Skill。用上面的表单创建一份，或手动放入 SKILL.md 后点刷新。</p>
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
