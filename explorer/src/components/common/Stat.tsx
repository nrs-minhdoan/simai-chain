import type { ReactNode } from "react";

export default function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={mono ? "stat-value mono" : "stat-value"}>{value}</span>
    </div>
  );
}
