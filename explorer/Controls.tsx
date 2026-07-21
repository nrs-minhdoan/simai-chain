import { useState } from 'react';
import type { MempoolView } from '../sim';
import type { UserLabel } from '../sim';
import type { Actions } from '../useChainSim';
import { Pill } from './ui';

const USERS: UserLabel[] = ['alice', 'bob', 'carol'];

function Select({ value, onChange }: { value: UserLabel; onChange: (u: UserLabel) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as UserLabel)}>
      {USERS.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

export function Controls({ mempool, tokenReady, actions, onDeploy }: {
  mempool: MempoolView[]; tokenReady: boolean; actions: Actions; onDeploy: boolean;
}) {
  const [cFrom, setCFrom] = useState<UserLabel>('alice');
  const [cTo, setCTo] = useState<UserLabel>('bob');
  const [cAmt, setCAmt] = useState('10');
  const [mTo, setMTo] = useState<UserLabel>('alice');
  const [mAmt, setMAmt] = useState('1000');
  const [tFrom, setTFrom] = useState<UserLabel>('alice');
  const [tTo, setTTo] = useState<UserLabel>('bob');
  const [tAmt, setTAmt] = useState('100');

  return (
    <div className="controls">
      <div className="form-group">
        <span className="form-title">Chuyển coin</span>
        <div className="form-row">
          <Select value={cFrom} onChange={setCFrom} />
          <span className="arrow">→</span>
          <Select value={cTo} onChange={setCTo} />
          <input className="amt" value={cAmt} onChange={(e) => setCAmt(e.target.value)} inputMode="decimal" />
          <button className="btn" onClick={() => actions.addTransfer(cFrom, cTo, cAmt)}>Thêm</button>
        </div>
      </div>

      <div className="form-group">
        <span className="form-title">Smart contract (token)</span>
        <div className="form-row">
          <button className="btn" disabled={onDeploy} onClick={actions.deployToken}>
            {onDeploy ? 'Token đã có' : 'Deploy Token'}
          </button>
        </div>
        <div className="form-row" data-disabled={!tokenReady}>
          <span className="mini">mint</span>
          <Select value={mTo} onChange={setMTo} />
          <input className="amt" value={mAmt} onChange={(e) => setMAmt(e.target.value)} inputMode="decimal" />
          <button className="btn" disabled={!tokenReady} onClick={() => actions.mintToken(mTo, mAmt)}>Thêm</button>
        </div>
        <div className="form-row" data-disabled={!tokenReady}>
          <span className="mini">gửi</span>
          <Select value={tFrom} onChange={setTFrom} />
          <span className="arrow">→</span>
          <Select value={tTo} onChange={setTTo} />
          <input className="amt" value={tAmt} onChange={(e) => setTAmt(e.target.value)} inputMode="decimal" />
          <button className="btn" disabled={!tokenReady} onClick={() => actions.transferToken(tFrom, tTo, tAmt)}>Thêm</button>
        </div>
      </div>

      <div className="mempool">
        <div className="mempool-head">
          <span>Mempool · {mempool.length} giao dịch chờ</span>
          {mempool.length > 0 && <button className="link" onClick={actions.clearMempool}>xoá</button>}
        </div>
        {mempool.length === 0
          ? <p className="empty">Trống. Thêm giao dịch rồi bấm “Chốt block”.</p>
          : <ul className="mempool-list">
              {mempool.map((m, i) => (
                <li key={i}>
                  <Pill kind={m.type === 'transfer' ? 'ok' : m.type === 'deploy' ? 'warn' : 'muted'}>{m.type}</Pill>
                  <span>{m.note}</span>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}
