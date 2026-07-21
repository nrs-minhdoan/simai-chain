import type { TelemetryView, VoteView } from '../sim';

// Đồng hồ chốt: thanh quyền biểu quyết với vạch ngưỡng 2/3.
function Meter({ label, power, total, threshold, committed }: {
  label: string; power: number; total: number; threshold: number; committed: boolean;
}) {
  const pct = total ? (power / total) * 100 : 0;
  const thresholdPct = 66.6667; // vạch > 2/3
  const pass = power >= threshold;
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="meter-label">{label}</span>
        <span className="meter-count mono">{power}<span className="dim">/{total}</span></span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${pass ? 'fill-ok' : 'fill-low'}`} style={{ width: `${pct}%` }} />
        <div className="meter-threshold" style={{ left: `${thresholdPct}%` }} title="ngưỡng > 2/3" />
      </div>
    </div>
  );
}

function VoteChip({ v }: { v: VoteView }) {
  return (
    <div className={`chip chip-${v.voted} ${v.isProposer ? 'chip-proposer' : ''}`} title={v.voted}>
      <span className="chip-dot" />
      <span className="chip-name">{v.name}</span>
      {v.isProposer && <span className="chip-tag">proposer</span>}
    </div>
  );
}

export function ConsensusGauge({ t }: { t: TelemetryView | null }) {
  if (!t) {
    return (
      <div className="gauge gauge-empty">
        <p>Chưa có vòng đồng thuận nào. Thêm giao dịch vào mempool rồi bấm <b>Chốt block</b> để xem quá trình pre-vote → pre-commit → commit.</p>
      </div>
    );
  }
  return (
    <div className="gauge">
      <div className="gauge-status">
        <span className={`verdict ${t.committed ? 'verdict-ok' : 'verdict-fail'}`}>
          {t.committed ? '● ĐÃ CHỐT' : '○ CHƯA CHỐT'}
        </span>
        <span className="gauge-meta mono">height {t.height} · proposer {t.proposerName} · cần ≥ {t.threshold}/{t.total}</span>
      </div>
      <Meter label="Pre-vote" power={t.prevote} total={t.total} threshold={t.threshold} committed={t.committed} />
      <Meter label="Pre-commit" power={t.precommit} total={t.total} threshold={t.threshold} committed={t.committed} />
      <div className="chips">
        {t.prevotes.map((v) => <VoteChip key={v.name} v={v} />)}
      </div>
      <div className="legend">
        <span><i className="dot dot-valid" />hợp lệ</span>
        <span><i className="dot dot-bogus" />bỏ phiếu rác</span>
        <span><i className="dot dot-nil" />im lặng</span>
      </div>
    </div>
  );
}
