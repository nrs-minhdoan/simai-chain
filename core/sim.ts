// ---------------------------------------------------------------------------
// sim.ts — Bộ điều khiển mô phỏng (không phụ thuộc React). Giữ Chain, ví, cấu
// hình validator, mempool; cung cấp action + xuất "snapshot" thuần chuỗi/số để
// React render (đã đổi BigInt -> string/number cho an toàn).
// ---------------------------------------------------------------------------
import {
  Chain, newWallet, parseFixed, formatFixed, makeTx, query, short,
  predictContractAddress, tokenCode, M_MINT, M_TRANSFER, M_BALANCEOF,
  type Validator, type Tx, type Hex, type ByzantineMode, type RoundTelemetry,
  type Block, type Wallet,
} from '@chain-sim/core';

export type UserLabel = 'alice' | 'bob' | 'carol';

export interface AccountView {
  address: Hex; label: string; balance: string; nonce: string; isContract: boolean;
}
export interface TxView {
  hash: Hex; type: string; note: string; value: string; nonce: string; gas: string;
}
export interface BlockView {
  height: number; hash: Hex; prevHash: Hex; txRoot: Hex; stateRoot: Hex;
  proposer: string; timestamp: string; txCount: number; commitSigs: number; txs: TxView[];
}
export interface VoteView { name: string; power: number; voted: 'valid' | 'bogus' | 'nil'; isProposer: boolean; }
export interface TelemetryView {
  height: number; proposerName: string; total: number; threshold: number;
  prevote: number; precommit: number; committed: boolean;
  prevotes: VoteView[]; precommits: VoteView[];
}
export interface ValidatorView { name: string; address: Hex; byzantine: ByzantineMode; }
export interface MempoolView { note: string; type: string; }
export interface SimState {
  height: number; headHash: Hex; stateRoot: Hex; totalPower: number; threshold: number;
  validators: ValidatorView[];
  blocks: BlockView[];
  accounts: AccountView[];
  tokenAddr: Hex | null;
  tokenBalances: { label: string; balance: string }[];
  mempool: MempoolView[];
  lastRound: TelemetryView | null;
  log: string[];
}

const addrToBig = (a: Hex): bigint => BigInt(a);
const bigToAddr = (v: bigint): Hex => ('0x' + v.toString(16).padStart(40, '0')) as Hex;

export class ChainSim {
  private validators!: Validator[];
  private users!: Record<UserLabel, Wallet>;
  private labels!: Map<Hex, string>;
  private chain!: Chain;
  private mempool!: { tx: Tx; note: string }[];
  private tokenAddr!: Hex | null;
  private log!: string[];
  private lastTelemetry!: RoundTelemetry | null;

  constructor() { this.reset(); }

  reset(): void {
    this.validators = [0, 1, 2, 3].map((i) => ({
      wallet: newWallet(), byzantine: 'none', power: 1n, name: `V${i}`,
    }));
    this.users = { alice: newWallet(), bob: newWallet(), carol: newWallet() };
    this.labels = new Map();
    this.validators.forEach((v) => this.labels.set(v.wallet.address, v.name!));
    (Object.keys(this.users) as UserLabel[]).forEach((k) => this.labels.set(this.users[k].address, k));
    this.chain = new Chain(this.validators);
    this.mempool = [];
    this.tokenAddr = null;
    this.log = [];
    this.lastTelemetry = null;

    // Genesis: cấp phát rồi chốt block 0.
    this.chain.state.credit(this.users.alice.address, parseFixed('100'));
    this.chain.state.credit(this.users.bob.address, parseFixed('50'));
    this.chain.commit([], { log: (s) => s && this.log.unshift(s) });
    this.labelToken();
  }

  private label(a: Hex): string { return this.labels.get(a) ?? short(a); }

  private nextNonce(addr: Hex): bigint {
    const base = this.chain.state.get(addr).nonce;
    const pending = this.mempool.filter((m) => m.tx.from === addr).length;
    return base + BigInt(pending);
  }

  // --- actions -------------------------------------------------------------
  addTransfer(fromLabel: UserLabel, toLabel: UserLabel, amount: string): void {
    if (fromLabel === toLabel) return;
    const from = this.users[fromLabel];
    const tx = makeTx({
      type: 'transfer', from: from.address, priv: from.priv,
      nonce: this.nextNonce(from.address), to: this.users[toLabel].address, value: parseFixed(amount),
    });
    this.mempool.push({ tx, note: `${fromLabel} → ${toLabel}: ${amount}` });
  }

  deployToken(): void {
    if (this.tokenAddr) return;
    const from = this.users.alice;
    const nonce = this.nextNonce(from.address);
    const tx = makeTx({ type: 'deploy', from: from.address, priv: from.priv, nonce, code: tokenCode });
    this.tokenAddr = predictContractAddress(from.address, nonce);
    this.labels.set(this.tokenAddr, 'Token');
    this.mempool.push({ tx, note: 'deploy Token (alice là owner)' });
  }

  mintToken(toLabel: UserLabel, amount: string): void {
    if (!this.tokenAddr) return;
    const from = this.users.alice; // owner
    const tx = makeTx({
      type: 'call', from: from.address, priv: from.priv, nonce: this.nextNonce(from.address),
      to: this.tokenAddr, dataArgs: [M_MINT, addrToBig(this.users[toLabel].address), parseFixed(amount)],
    });
    this.mempool.push({ tx, note: `mint ${amount} token → ${toLabel}` });
  }

  transferToken(fromLabel: UserLabel, toLabel: UserLabel, amount: string): void {
    if (!this.tokenAddr || fromLabel === toLabel) return;
    const from = this.users[fromLabel];
    const tx = makeTx({
      type: 'call', from: from.address, priv: from.priv, nonce: this.nextNonce(from.address),
      to: this.tokenAddr, dataArgs: [M_TRANSFER, addrToBig(this.users[toLabel].address), parseFixed(amount)],
    });
    this.mempool.push({ tx, note: `token ${amount}: ${fromLabel} → ${toLabel}` });
  }

  setByzantine(name: string, mode: ByzantineMode): void {
    const v = this.validators.find((x) => x.name === name);
    if (v) v.byzantine = mode;
  }

  clearMempool(): void { this.mempool = []; }

  mineBlock(): void {
    const captured: string[] = [];
    const res = this.chain.commit(this.mempool.map((m) => m.tx), {
      validators: this.validators, log: (s) => s && captured.push(s.trim()),
    });
    this.log = [...captured.reverse(), ...this.log].slice(0, 60);
    this.lastTelemetry = res.telemetry;
    if (res.committed) {
      this.labelToken();
      this.mempool = []; // đã đưa vào block
    }
    // nếu không chốt: giữ nguyên mempool để người dùng chỉnh (tắt Byzantine...)
  }

  private labelToken(): void {
    for (const [addr, a] of this.chain.state.accounts) {
      if (a.code) { this.tokenAddr = addr; this.labels.set(addr, 'Token'); }
    }
  }

  // --- snapshot ------------------------------------------------------------
  private decodeTx(tx: Tx): TxView {
    let note = '';
    if (tx.type === 'transfer') note = `${this.label(tx.from)} → ${this.label(tx.to!)}`;
    else if (tx.type === 'deploy') note = `deploy contract`;
    else {
      const method = tx.dataArgs[0];
      if (tx.to === this.tokenAddr && method === M_MINT)
        note = `mint ${formatFixed(tx.dataArgs[2]!)} → ${this.label(bigToAddr(tx.dataArgs[1]!))}`;
      else if (tx.to === this.tokenAddr && method === M_TRANSFER)
        note = `token ${formatFixed(tx.dataArgs[2]!)}: ${this.label(tx.from)} → ${this.label(bigToAddr(tx.dataArgs[1]!))}`;
      else note = `call ${this.label(tx.to!)}`;
    }
    return {
      hash: tx.hash!, type: tx.type, note,
      value: formatFixed(tx.value), nonce: tx.nonce.toString(), gas: tx.gasLimit.toString(),
    };
  }

  private blockView(b: Block): BlockView {
    return {
      height: Number(b.header.height), hash: b.hash, prevHash: b.header.prevHash,
      txRoot: b.header.txRoot, stateRoot: b.header.stateRoot,
      proposer: this.label(b.header.proposer), timestamp: b.header.timestamp.toString(),
      txCount: b.txs.length, commitSigs: b.commit ? b.commit.length : 0,
      txs: b.txs.map((t) => this.decodeTx(t)),
    };
  }

  private telemetryView(t: RoundTelemetry): TelemetryView {
    const toVotes = (list: RoundTelemetry['prevotes']): VoteView[] =>
      list.map((v) => ({
        name: v.name ?? short(v.voter), power: Number(v.power), voted: v.voted,
        isProposer: v.voter === t.proposer,
      }));
    return {
      height: t.height, proposerName: this.label(t.proposer),
      total: Number(t.totalPower), threshold: Number(t.thresholdPower),
      prevote: Number(t.prevotePower), precommit: Number(t.precommitPower),
      committed: t.committed, prevotes: toVotes(t.prevotes), precommits: toVotes(t.precommits),
    };
  }

  snapshot(): SimState {
    const total = this.validators.reduce((n, v) => n + Number(v.power), 0);
    const accounts: AccountView[] = [...this.chain.state.accounts.entries()].map(([addr, a]) => ({
      address: addr, label: this.label(addr), balance: formatFixed(a.balance),
      nonce: a.nonce.toString(), isContract: !!a.code,
    })).sort((x, y) => (x.isContract === y.isContract ? x.label.localeCompare(y.label) : x.isContract ? 1 : -1));

    const tokenBalances = this.tokenAddr
      ? (['alice', 'bob', 'carol'] as UserLabel[]).map((k) => {
          const v = query(this.chain.state, this.tokenAddr!, [M_BALANCEOF, addrToBig(this.users[k].address)]);
          return { label: k, balance: v === null ? '0' : formatFixed(v) };
        })
      : [];

    return {
      height: this.chain.height,
      headHash: this.chain.head ? this.chain.head.hash : ('0x' as Hex),
      stateRoot: this.chain.state.stateRoot(),
      totalPower: total,
      threshold: Math.floor((total * 2) / 3) + 1,
      validators: this.validators.map((v) => ({ name: v.name!, address: v.wallet.address, byzantine: v.byzantine })),
      blocks: this.chain.blocks.map((b) => this.blockView(b)).reverse(), // mới nhất lên đầu
      accounts,
      tokenAddr: this.tokenAddr,
      tokenBalances,
      mempool: this.mempool.map((m) => ({ note: m.note, type: m.tx.type })),
      lastRound: this.lastTelemetry ? this.telemetryView(this.lastTelemetry) : null,
      log: this.log,
    };
  }
}
