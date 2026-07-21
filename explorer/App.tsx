import { useChainSim } from './useChainSim';
import { Panel, Hash, Stat } from './components/ui';
import { ConsensusGauge } from './components/ConsensusGauge';
import { Validators } from './components/Validators';
import { Controls } from './components/Controls';
import { Blocks } from './components/Blocks';
import { Accounts, TokenBalances, LogView } from './components/Panels';

export default function App() {
  const { state, actions } = useChainSim();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>chain-sim</h1>
            <span className="brand-sub">bộ mô phỏng blockchain BFT · explorer chạy ngay trong trình duyệt</span>
          </div>
        </div>
        <div className="topstats">
          <Stat label="height" value={state.height} mono />
          <Stat label="head" value={<Hash value={state.headHash} chars={5} />} />
          <Stat label="state root" value={<Hash value={state.stateRoot} chars={5} />} />
          <Stat label="validator" value={`${state.validators.length} · ngưỡng ≥ ${state.threshold}`} mono />
        </div>
        <div className="topactions">
          <button className="btn btn-primary" onClick={actions.mine}>Chốt block</button>
          <button className="btn btn-ghost" onClick={actions.reset}>Đặt lại</button>
        </div>
      </header>

      <section className="hero">
        <span className="eyebrow">vòng đồng thuận gần nhất</span>
        <ConsensusGauge t={state.lastRound} />
      </section>

      <main className="grid">
        <div className="col col-left">
          <Panel eyebrow="tác nhân" title="Validator">
            <Validators validators={state.validators} onSet={actions.setByzantine} />
          </Panel>
          <Panel eyebrow="soạn giao dịch" title="Mempool">
            <Controls
              mempool={state.mempool}
              tokenReady={!!state.tokenAddr}
              onDeploy={!!state.tokenAddr}
              actions={actions}
            />
          </Panel>
        </div>

        <div className="col col-center">
          <Panel eyebrow="sổ cái" title="Chuỗi block" actions={<span className="count">{state.height} block</span>}>
            <Blocks blocks={state.blocks} />
          </Panel>
        </div>

        <div className="col col-right">
          <Panel eyebrow="trạng thái" title="Tài khoản">
            <Accounts accounts={state.accounts} />
          </Panel>
          <Panel eyebrow="ERC-like" title="Số dư token"
            actions={state.tokenAddr ? <Hash value={state.tokenAddr} chars={4} /> : undefined}>
            <TokenBalances token={state.tokenBalances} />
          </Panel>
          <Panel eyebrow="nhật ký" title="Consensus log">
            <LogView log={state.log} />
          </Panel>
        </div>
      </main>

      <footer className="foot">
        <span>Bảo mật dựa trên chữ ký secp256k1 + ngưỡng &gt; 2/3, không dựa vào việc giấu code (Kerckhoffs).</span>
      </footer>
    </div>
  );
}
