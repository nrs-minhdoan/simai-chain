import type { ValidatorView } from '../sim';
import type { ByzantineMode } from '@chain-sim/core';
import { Hash } from './ui';

const MODES: { mode: ByzantineMode; label: string }[] = [
  { mode: 'none', label: 'trung thực' },
  { mode: 'equivocate', label: 'bỏ phiếu rác' },
  { mode: 'silent', label: 'im lặng' },
];

export function Validators({ validators, onSet }: {
  validators: ValidatorView[];
  onSet: (name: string, mode: ByzantineMode) => void;
}) {
  const faulty = validators.filter((v) => v.byzantine !== 'none').length;
  return (
    <div className="validators">
      <p className="hint">
        BFT chịu được &lt; 1/3 node lỗi. Đang lỗi: <b>{faulty}/{validators.length}</b>
        {faulty >= Math.ceil(validators.length / 3) && <span className="warn-text"> — vượt ngưỡng, chain có thể dừng chốt</span>}
      </p>
      {validators.map((v) => (
        <div key={v.name} className={`validator-row byz-${v.byzantine}`}>
          <div className="validator-id">
            <span className="validator-name">{v.name}</span>
            <Hash value={v.address} chars={4} />
          </div>
          <div className="seg">
            {MODES.map((m) => (
              <button
                key={m.mode}
                className={`seg-btn ${v.byzantine === m.mode ? 'seg-active' : ''}`}
                onClick={() => onSet(v.name, m.mode)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
