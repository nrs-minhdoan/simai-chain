import { useState } from "react";
import type { MempoolView } from "../types/sim";
import type { UserLabel } from "../types/sim";
import type { Actions } from "../hooks/useChainSimulator";
import { NATIVE_SYMBOL } from "@core/constants/config";
import Pill from "./common/Pill";

const USERS: UserLabel[] = ["alice", "bob", "carol"];

// Chỉ cho gõ số + tối đa 1 dấu chấm - chặn ký tự lạ (vd "10abc") khiến parseFixed
// ở tầng core văng lỗi không bắt được khi bấm "Thêm".
const AMOUNT_CHARS_RE = /^\d*\.?\d*$/;
const sanitizeAmount = (raw: string): string =>
  AMOUNT_CHARS_RE.test(raw) ? raw : raw.replace(/[^\d.]/g, "");
const isPositiveAmount = (s: string): boolean =>
  /^\d+(\.\d+)?$/.test(s) && /[1-9]/.test(s);

function Select({
  value,
  onChange,
}: {
  value: UserLabel;
  onChange: (u: UserLabel) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as UserLabel)}
    >
      {USERS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

export default function Controls({
  mempool,
  tokenReady,
  actions,
  onDeploy,
}: {
  mempool: MempoolView[];
  tokenReady: boolean;
  actions: Actions;
  onDeploy: boolean;
}) {
  const [cFrom, setCFrom] = useState<UserLabel>("alice");
  const [cTo, setCTo] = useState<UserLabel>("bob");
  const [cAmt, setCAmt] = useState("10");
  const [mTo, setMTo] = useState<UserLabel>("alice");
  const [mAmt, setMAmt] = useState("1000");
  const [tFrom, setTFrom] = useState<UserLabel>("alice");
  const [tTo, setTTo] = useState<UserLabel>("bob");
  const [tAmt, setTAmt] = useState("100");

  return (
    <div className="controls">
      <div className="form-group">
        <span className="form-title">Chuyển {NATIVE_SYMBOL}</span>
        <div className="form-row">
          <Select value={cFrom} onChange={setCFrom} />
          <span className="arrow">→</span>
          <Select value={cTo} onChange={setCTo} />
          <input
            className="amt"
            value={cAmt}
            onChange={(e) => setCAmt(sanitizeAmount(e.target.value))}
            inputMode="decimal"
          />
          <button
            className="btn"
            disabled={!isPositiveAmount(cAmt)}
            onClick={() => actions.addTransfer(cFrom, cTo, cAmt)}
          >
            Thêm
          </button>
        </div>
      </div>

      <div className="form-group">
        <span className="form-title">Smart contract (token)</span>
        <div className="form-row">
          <button
            className="btn"
            disabled={onDeploy}
            onClick={actions.deployToken}
          >
            {onDeploy ? "Token đã có" : "Deploy Token"}
          </button>
        </div>
        <div className="form-row" data-disabled={!tokenReady}>
          <span className="mini">mint</span>
          <Select value={mTo} onChange={setMTo} />
          <input
            className="amt"
            value={mAmt}
            onChange={(e) => setMAmt(sanitizeAmount(e.target.value))}
            inputMode="decimal"
          />
          <button
            className="btn"
            disabled={!tokenReady || !isPositiveAmount(mAmt)}
            onClick={() => actions.mintToken(mTo, mAmt)}
          >
            Thêm
          </button>
        </div>
        <div className="form-row" data-disabled={!tokenReady}>
          <span className="mini">gửi</span>
          <Select value={tFrom} onChange={setTFrom} />
          <span className="arrow">→</span>
          <Select value={tTo} onChange={setTTo} />
          <input
            className="amt"
            value={tAmt}
            onChange={(e) => setTAmt(sanitizeAmount(e.target.value))}
            inputMode="decimal"
          />
          <button
            className="btn"
            disabled={!tokenReady || !isPositiveAmount(tAmt)}
            onClick={() => actions.transferToken(tFrom, tTo, tAmt)}
          >
            Thêm
          </button>
        </div>
      </div>

      <div className="mempool">
        <div className="mempool-head">
          <span>Mempool · {mempool.length} giao dịch chờ</span>
          {mempool.length > 0 && (
            <button className="link" onClick={actions.clearMempool}>
              xoá
            </button>
          )}
        </div>
        {mempool.length === 0 ? (
          <p className="empty">Trống. Thêm giao dịch rồi bấm “Đóng block”.</p>
        ) : (
          <ul className="mempool-list">
            {mempool.map((m, i) => (
              <li key={i}>
                <Pill
                  kind={
                    m.type === "transfer"
                      ? "ok"
                      : m.type === "deploy"
                        ? "warn"
                        : "muted"
                  }
                >
                  {m.type}
                </Pill>
                <span>{m.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
