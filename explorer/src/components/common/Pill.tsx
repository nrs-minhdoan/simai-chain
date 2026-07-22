import type { ReactNode } from "react";

export default function Pill({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "fault" | "muted" | "info";
  children: ReactNode;
}) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}
