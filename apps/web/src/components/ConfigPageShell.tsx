import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ConfigPageShell({
  icon: Icon,
  title,
  detail,
  badge,
  notice,
  error,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  badge?: string;
  notice?: string | null;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 h-full w-full overflow-y-auto overscroll-contain bg-[var(--bg-app)] [scrollbar-gutter:stable]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-8 select-text">
        <div className="border-b border-[#0000000a] pb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#0000000c] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#5e5c54]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[#1f1e1d] tracking-tight">{title}</h1>
              <p className="text-xs text-[#7e7d77] mt-1">{detail}</p>
            </div>
          </div>
          {badge ? (
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#edece6] text-[#4f4e4a] shrink-0">
              {badge}
            </span>
          ) : null}
        </div>
        {notice ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
