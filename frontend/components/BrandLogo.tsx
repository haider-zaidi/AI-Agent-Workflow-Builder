import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-9 w-9", icon: "h-4.5 w-4.5" },
  lg: { box: "h-10 w-10", icon: "h-5 w-5" },
  hero: { box: "h-16 w-16 sm:h-20 sm:w-20", icon: "h-8 w-8 sm:h-10 sm:w-10" },
} as const;

export type BrandLogoSize = keyof typeof SIZES;

/** AI Agent Workflow Builder mark — gradient square with a workflow glyph. */
export function BrandLogo({ size = "md", className }: { size?: BrandLogoSize; className?: string }) {
  const cfg = SIZES[size];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        "bg-gradient-to-br from-primary via-[var(--primary-mix)] to-fuchsia-500",
        "shadow-[0_8px_24px_-8px_rgba(91,141,239,0.55)] ring-1 ring-white/15",
        size === "hero" && "rounded-2xl",
        cfg.box,
        className
      )}
    >
      <Workflow className={cn(cfg.icon, "text-white")} strokeWidth={2} />
    </span>
  );
}
