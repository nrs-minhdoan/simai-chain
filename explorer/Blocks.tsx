import { useState } from 'react';
import type { BlockView } from '../sim';
import { Hash, Pill } from './ui';

function TxRow({ tx }: { tx: BlockView['txs'][number] }) {
  return (
    <li className="tx-row">
      <Pill kind={tx.type === 'transfer' ? 'ok' : tx.type === 'deploy' ? 'warn' : 'muted'}>{tx.type}</Pill>
      <span className="tx-note">{tx.note}</span>
      {tx.type !== 'deploy' && tx.value !== '0' && <span className="tx-val mono">{tx.value}</span>}
      <Hash value={tx.hash} chars={4} />
    </li>
  );
}

function BlockCard({ b, open, onToggle }: { b: BlockView; open: boolean; onToggle: () => void }) {
  return (
    <div className={`block-card ${open ? 'open' : ''}`}>
      <button className="block-summary" onClick={onToggle}>
        <span className="block-height mono">#{b.height}</span>
        <Hash value={b.hash} chars={5} />
        <span className="block-meta">{b.txCount} tx · {b.commitSigs} chữ ký</span>
        <span className="block-proposer">{b.proposer}</span>
        <span className="chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="block-detail">
          <div className="kv"><span>prevHash</span><Hash value={b.prevHash} /></div>
          <div className="kv"><span>txRoot</span><Hash value={b.txRoot} /></div>
          <div className="kv"><span>stateRoot</span><Hash value={b.stateRoot} /></div>
          <div className="kv"><span>proposer</span><span>{b.proposer}</span></div>
          {b.txs.length > 0
            ? <ul className="tx-list">{b.txs.map((t) => <TxRow key={t.hash} tx={t} />)}</ul>
            : <p className="empty">Block rỗng (không có giao dịch).</p>}
        </div>
      )}
    </div>
  );
}

export function Blocks({ blocks }: { blocks: BlockView[] }) {
  const [openH, setOpenH] = useState<number | null>(blocks.length ? blocks[0]!.height : null);
  return (
    <div className="blocks">
      {blocks.map((b) => (
        <BlockCard key={b.hash} b={b} open={openH === b.height} onToggle={() => setOpenH(openH === b.height ? null : b.height)} />
      ))}
    </div>
  );
}
