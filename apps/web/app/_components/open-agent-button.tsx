"use client";

import type { ReactNode } from "react";

export function OpenAgentButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("tael-agent:open"))}
    >
      {children}
    </button>
  );
}
