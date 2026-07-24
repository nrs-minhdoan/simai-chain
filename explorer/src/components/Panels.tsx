import type { ReactNode } from "react";
import type { AccountView, SimState } from "../types/sim";
import Hash from "./common/Hash";
import Pill from "./common/Pill";

export function Accounts({ accounts }: { accounts: AccountView[] }) {
  return (
    <div className="table-scroll">
      <table className="accounts">
        <thead>
          <tr>
            <th>tài khoản</th>
            <th>số dư</th>
            <th>nonce</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.address}>
              <td>
                <span className="acct-label">{a.label}</span>
                {a.isContract && <Pill kind="warn">contract</Pill>}
                {a.isValidator && <Pill kind="muted">validator</Pill>}
                <div>
                  <Hash value={a.address} chars={4} />
                </div>
              </td>
              <td className="mono num">{a.balance}</td>
              <td className="mono num">{a.nonce}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TokenBalances({
  token,
  symbol,
  maxSupply,
  totalSupply,
}: {
  token: SimState["tokenBalances"];
  symbol: SimState["tokenSymbol"];
  maxSupply: SimState["tokenMaxSupply"];
  totalSupply: SimState["tokenTotalSupply"];
}) {
  if (token.length === 0) return <p className="empty">Chưa deploy token.</p>;
  return (
    <>
      {symbol && (
        <p className="token-supply">
          <span className="mono">{symbol}</span> · tổng cung đã mint{" "}
          <span className="mono">{totalSupply}</span> / trần{" "}
          <span className="mono">{maxSupply}</span>
        </p>
      )}
      <ul className="token-bal">
        {token.map((t) => (
          <li key={t.label}>
            <span>{t.label}</span>
            <span className="mono num">{t.balance}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// Dòng log từ consensus.ts luôn mở đầu bằng 1 trong 3 từ này -> tách riêng thành tag,
// phần còn lại giữ nguyên làm description như cũ.
const LOG_LEADING_TAG_RE = /^(PRE-COMMIT|PRE-VOTE|COMMIT)\b(.*)$/;
const LOG_LEADING_TAG_KIND: Record<string, "ok" | "warn" | "muted"> = {
  COMMIT: "ok",
  "PRE-COMMIT": "warn",
  "PRE-VOTE": "muted",
};
// Dòng "Height X Round Y: proposer = ..." không tách HEIGHT/ROUND thành tag riêng -
// chỉ gắn 1 tag INFO chung ở đầu, giữ nguyên toàn bộ nội dung phía sau.
const LOG_INFO_RE = /^Height\b/;

function renderLogText(text: string): ReactNode {
  const leading = LOG_LEADING_TAG_RE.exec(text);
  if (leading) {
    const tag = leading[1]!;
    return (
      <>
        <Pill kind={LOG_LEADING_TAG_KIND[tag]!}>{tag}</Pill>
        {leading[2]}
      </>
    );
  }
  if (LOG_INFO_RE.test(text)) {
    return (
      <>
        <Pill kind="info">INFO</Pill> {text}
      </>
    );
  }
  return text;
}

export function LogView({ log }: { log: SimState["log"] }) {
  if (log.length === 0)
    return <p className="empty">Chưa có nhật ký. Đóng một block để xem.</p>;
  return (
    <div className="log">
      {log.map((l) => (
        <div key={l.id} className="log-line mono">
          {renderLogText(l.text)}
        </div>
      ))}
    </div>
  );
}
