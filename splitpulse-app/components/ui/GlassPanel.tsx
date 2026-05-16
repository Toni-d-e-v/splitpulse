import { type HTMLAttributes } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  heavy?: boolean;
}

export function GlassPanel({
  heavy = false,
  className = "",
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={`${heavy ? "glass-panel-heavy" : "glass-panel"} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
