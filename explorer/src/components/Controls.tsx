import { useState } from "react";
import type { MempoolView } from "../types/sim";
import type { UserLabel } from "../types/sim";
import type { Actions } from "../hooks/useChainSimulator";
import { NATIVE_SYMBOL, MEMO_MAX_LENGTH } from "@core/constants/config";
import { TOKEN_SYMBOL_MAX_LEN } from "@core/vm/token";
import Pill from "./common/Pill";
import Select from "./common/Select";

const USERS: UserLabel[] = ["alice", "bob", "carol"];

// Chỉ cho gõ số + tối đa 1 dấu chấm - chặn ký tự lạ (vd "10abc") khiến parseFixed
// ở tầng core văng lỗi không bắt được khi bấm "Gửi".
const AMOUNT_CHARS_RE = /^\d*\.?\d*$/;
const sanitizeAmount = (raw: string): string =>
  AMOUNT_CHARS_RE.test(raw) ? raw : raw.replace(/[^\d.]/g, "");
const isPositiveAmount = (s: string): boolean =>
  /^\d+(\.\d+)?$/.test(s) && /[1-9]/.test(s);

// Symbol chỉ chấp nhận chữ/số in hoa (vd "TOK") - packSymbol() (core/vm/token.ts) chỉ
// pack thành bigint để hiển thị lại, không parse/validate gì thêm ở tầng VM.
const sanitizeSymbol = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TOKEN_SYMBOL_MAX_LEN);

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
  const [cMemo, setCMemo] = useState("");
  const [dSymbol, setDSymbol] = useState("TOK");
  const [dMaxSupply, setDMaxSupply] = useState("1000000");
  const [mTo, setMTo] = useState<UserLabel>("alice");
  const [mAmt, setMAmt] = useState("1000");
  const [tFrom, setTFrom] = useState<UserLabel>("alice");
  const [tTo, setTTo] = useState<UserLabel>("bob");
  const [tAmt, setTAmt] = useState("100");

  return (
    <div className="controls">
      <div className="tx-card">
        <span className="form-title">Chuyển {NATIVE_SYMBOL}</span>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Từ</span>
            <Select
              value={cFrom}
              options={USERS}
              onChange={setCFrom}
              label="Từ"
            />
          </label>
          <span className="field field-arrow">
            <span className="field-label" aria-hidden>
              &nbsp;
            </span>
            <span className="arrow">→</span>
          </span>
          <label className="field">
            <span className="field-label">Đến</span>
            <Select value={cTo} options={USERS} onChange={setCTo} label="Đến" />
          </label>
          <label className="field">
            <span className="field-label">Số lượng</span>
            <input
              className="amt"
              value={cAmt}
              onChange={(e) => setCAmt(sanitizeAmount(e.target.value))}
              inputMode="decimal"
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field field-grow">
            <span className="field-label">Lời nhắn (tuỳ chọn)</span>
            <input
              className="memo"
              value={cMemo}
              onChange={(e) =>
                setCMemo(e.target.value.slice(0, MEMO_MAX_LENGTH))
              }
              placeholder="vd: trả tiền ăn trưa"
              maxLength={MEMO_MAX_LENGTH}
            />
          </label>
          <button
            className="btn"
            disabled={!isPositiveAmount(cAmt)}
            onClick={() => {
              actions.addTransfer(cFrom, cTo, cAmt, cMemo);
              setCMemo("");
            }}
          >
            Gửi
          </button>
        </div>
      </div>

      <hr className="section-divider" />

      <div className="form-group">
        <span className="form-title">Smart contract (token)</span>
        <div className="tx-card-stack">
          <div className="tx-card">
            <span className="form-title">Deploy Token</span>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Symbol</span>
                <input
                  className="amt symbol"
                  value={dSymbol}
                  onChange={(e) => setDSymbol(sanitizeSymbol(e.target.value))}
                  placeholder="TOK"
                  disabled={onDeploy}
                />
              </label>
              <label className="field">
                <span className="field-label">Trần tổng cung</span>
                <input
                  className="amt"
                  value={dMaxSupply}
                  onChange={(e) =>
                    setDMaxSupply(sanitizeAmount(e.target.value))
                  }
                  inputMode="decimal"
                  disabled={onDeploy}
                />
              </label>
              <button
                className="btn"
                disabled={onDeploy || !dSymbol || !isPositiveAmount(dMaxSupply)}
                onClick={() => actions.deployToken(dSymbol, dMaxSupply)}
              >
                {onDeploy ? "Token đã có" : "Gửi"}
              </button>
            </div>
          </div>

          <div className="tx-card" data-disabled={!tokenReady}>
            <span className="form-title">Mint token</span>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Tới</span>
                <Select
                  value={mTo}
                  options={USERS}
                  onChange={setMTo}
                  label="Tới"
                />
              </label>
              <label className="field">
                <span className="field-label">Số lượng</span>
                <input
                  className="amt"
                  value={mAmt}
                  onChange={(e) => setMAmt(sanitizeAmount(e.target.value))}
                  inputMode="decimal"
                />
              </label>
              <button
                className="btn"
                disabled={!tokenReady || !isPositiveAmount(mAmt)}
                onClick={() => actions.mintToken(mTo, mAmt)}
              >
                Gửi
              </button>
            </div>
          </div>

          <div className="tx-card" data-disabled={!tokenReady}>
            <span className="form-title">Chuyển token</span>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Từ</span>
                <Select
                  value={tFrom}
                  options={USERS}
                  onChange={setTFrom}
                  label="Từ"
                />
              </label>
              <span className="field field-arrow">
                <span className="field-label" aria-hidden>
                  &nbsp;
                </span>
                <span className="arrow">→</span>
              </span>
              <label className="field">
                <span className="field-label">Đến</span>
                <Select
                  value={tTo}
                  options={USERS}
                  onChange={setTTo}
                  label="Đến"
                />
              </label>
              <label className="field">
                <span className="field-label">Số lượng</span>
                <input
                  className="amt"
                  value={tAmt}
                  onChange={(e) => setTAmt(sanitizeAmount(e.target.value))}
                  inputMode="decimal"
                />
              </label>
              <button
                className="btn"
                disabled={!tokenReady || !isPositiveAmount(tAmt)}
                onClick={() => actions.transferToken(tFrom, tTo, tAmt)}
              >
                Gửi
              </button>
            </div>
          </div>
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
