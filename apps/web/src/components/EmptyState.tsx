import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export function EmptyState({
  icon,
  title,
  detail,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center max-w-md mx-auto px-6 py-10 select-none",
        className,
      )}
    >
      {icon ? (
        <div className="w-11 h-11 rounded-2xl bg-white border border-[var(--border-card)] shadow-[var(--shadow-card)] flex items-center justify-center mb-3 text-[#1f1e1d]">
          {icon}
        </div>
      ) : null}
      <h3 className="font-semibold text-[#1f1e1d] text-sm mb-1.5 tracking-tight">{title}</h3>
      {detail ? <p className="text-xs text-[#7e7d77] leading-relaxed">{detail}</p> : null}
      {children ? <div className="mt-4 w-full">{children}</div> : null}
    </div>
  );
}
