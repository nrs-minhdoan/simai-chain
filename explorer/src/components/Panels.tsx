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

export function TokenBalances({ token }: { token: SimState["tokenBalances"] }) {
  if (token.length === 0) return <p className="empty">Chưa deploy token.</p>;
  return (
    <ul className="token-bal">
      {token.map((t) => (
        <li key={t.label}>
          <span>{t.label}</span>
          <span className="mono num">{t.balance}</span>
        </li>
      ))}
    </ul>
  );
}

export function LogView({ log }: { log: SimState["log"] }) {
  if (log.length === 0)
    return <p className="empty">Chưa có nhật ký. Đóng một block để xem.</p>;
  return (
    <div className="log">
      {log.map((l) => (
        <div key={l.id} className="log-line mono">
          {l.text}
        </div>
      ))}
    </div>
  );
}
