import type { ReactNode } from 'react';

export function Panel({ title, eyebrow, children, actions }: {
  title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {actions}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Hash({ value, chars = 6 }: { value: string; chars?: number }) {
  const short = value.length > 12 ? `${value.slice(0, chars + 2)}…${value.slice(-chars)}` : value;
  return <span className="hash" title={value}>{short}</span>;
}

export function Stat({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={mono ? 'stat-value mono' : 'stat-value'}>{value}</span>
    </div>
  );
}

export function Pill({ kind, children }: { kind: 'ok' | 'warn' | 'fault' | 'muted'; children: ReactNode }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}
