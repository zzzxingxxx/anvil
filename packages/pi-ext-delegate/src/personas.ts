export type PersonaId = "architect" | "implementer" | "reviewer";

export const PERSONAS: Record<
  PersonaId,
  { label: string; tools: string[]; system: string }
> = {
  architect: {
    label: "架构师",
    tools: ["read", "grep", "find", "ls"],
    system: "你是架构师。只读分析，禁止再委派，禁止改文件。",
  },
  implementer: {
    label: "实现者",
    tools: ["read", "grep", "find", "ls", "write", "edit", "bash"],
    system: "你是实现者。只改目标范围内的文件。禁止再委派。完成后用不超过 20 行总结改了什么。",
  },
  reviewer: {
    label: "审查者",
    tools: ["read", "grep", "find", "ls"],
    system: "你是审查者。只读，不 bash、不写文件、不委派。",
  },
};

export function personaAllowsWrite(persona: string): boolean {
  return persona === "implementer";
}
