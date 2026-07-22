// ---------------------------------------------------------------------------
// simulator/chain-simulator.ts - Bộ điều khiển mô phỏng (không phụ thuộc React). Giữ
// Chain, ví, cấu hình validator, mempool; cung cấp action + xuất "snapshot" thuần
// chuỗi/số để React render (đã đổi BigInt -> string/number cho an toàn).
// ---------------------------------------------------------------------------
import { Chain } from "@core/chain/chain";
import { newWallet } from "@core/crypto/crypto";
import { parseFixed, formatFixed } from "@core/fixed-point/fixed-point";
import { makeTx } from "@core/transaction/transaction";
import { query, predictContractAddress } from "@core/transaction/processor";
import { short, blockReward } from "@core/consensus/consensus";
import { tokenCode, M_MINT, M_TRANSFER, M_BALANCEOF } from "@core/vm/token";
import type {
  Validator,
  Tx,
  Hex,
  ByzantineMode,
  RoundTelemetry,
  Block,
  Wallet,
} from "@core/types/types";
import type {
  UserLabel,
  AccountView,
  TxView,
  BlockView,
  VoteView,
  TelemetryView,
  ValidatorView,
  RoundHealthView,
  LogEntry,
  SimState,
} from "../types/sim";
import { VALIDATOR_COUNT } from "../constants/config";

// Lưới pin ở UI giờ không cố định số ô - nó tự đo bề rộng và luôn hiển thị đủ 5 hàng
// (xem ConsensusGauge.tsx), nên số này chỉ cần đủ LỚN để phủ cả màn hình rộng nhất
// (.app max-width 1400px -> tối đa ~41 cột x 5 hàng ≈ 205 ô), không cần khớp chính xác.
const ROUND_HISTORY_SIZE = 300;

const addrToBig = (a: Hex): bigint => BigInt(a);
const bigToAddr = (v: bigint): Hex =>
  ("0x" + v.toString(16).padStart(40, "0")) as Hex;

export class ChainSimulator {
  private validators!: Validator[];
  private users!: Record<UserLabel, Wallet>;
  private labels!: Map<Hex, string>;
  private chain!: Chain;
  private mempool!: { tx: Tx; note: string }[];
  private tokenAddr!: Hex | null;
  private log!: LogEntry[];
  private logSeq!: number;
  private lastTelemetry!: RoundTelemetry | null;
  private roundSeq!: number;
  private roundHistory!: RoundTelemetry[];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.validators = Array.from({ length: VALIDATOR_COUNT }, (_, i) => ({
      wallet: newWallet(),
      byzantine: "none",
      power: 1n,
      name: `V${i}`,
    }));
    this.users = { alice: newWallet(), bob: newWallet(), carol: newWallet() };
    this.labels = new Map();
    this.validators.forEach((v) => this.labels.set(v.wallet.address, v.name!));
    (Object.keys(this.users) as UserLabel[]).forEach((k) =>
      this.labels.set(this.users[k].address, k),
    );
    this.chain = new Chain(this.validators);
    this.mempool = [];
    this.tokenAddr = null;
    this.log = [];
    this.logSeq = 0;
    this.lastTelemetry = null;
    this.roundSeq = 0;
    this.roundHistory = [];

    // Genesis: cấp phát rồi chốt block 0.
    this.chain.state.credit(this.users.alice.address, parseFixed("100"));
    this.chain.state.credit(this.users.bob.address, parseFixed("50"));
    // Chạm vào tài khoản mỗi validator (dù balance = 0) để họ hiện ngay trong danh sách
    // Tài khoản từ đầu, thay vì chỉ xuất hiện khi tình cờ đề xuất block đầu tiên.
    this.validators.forEach((v) => this.chain.state.get(v.wallet.address));
    const genesisRes = this.chain.commit([], {
      log: (s) => s && this.pushLog(s),
    });
    this.roundHistory.push(genesisRes.telemetry);
    this.labelToken();
  }

  private pushLog(text: string): void {
    // trim ở đây (nguồn duy nhất) - các dòng log từ consensus.ts có 2 dấu cách đầu dòng
    // để canh cột khi in ra CLI (demo.ts), không liên quan gì tới UI. Trước đây chỉ
    // mineBlock() tự trim() trước khi đẩy vào, còn genesis (reset()) thì không, khiến
    // dòng log của genesis bị thụt lề trong khi các dòng sau lại không - không thẳng hàng.
    this.log.unshift({ id: this.logSeq++, text: text.trim() });
  }

  private label(a: Hex): string {
    return this.labels.get(a) ?? short(a);
  }

  private nextNonce(addr: Hex): bigint {
    const base = this.chain.state.get(addr).nonce;
    const pending = this.mempool.filter((m) => m.tx.from === addr).length;
    return base + BigInt(pending);
  }

  /** parseFixed văng lỗi nếu amount không phải số hợp lệ (vd gọi trực tiếp từ script/test,
   *  bỏ qua UI validate) - bắt lại ở đây để 1 input xấu không làm crash cả action. */
  private parseAmount(amount: string): bigint | null {
    try {
      return parseFixed(amount);
    } catch {
      this.pushLog(`✗ số tiền không hợp lệ: "${amount}"`);
      return null;
    }
  }

  // --- actions -------------------------------------------------------------
  addTransfer(fromLabel: UserLabel, toLabel: UserLabel, amount: string): void {
    if (fromLabel === toLabel) return;
    const value = this.parseAmount(amount);
    if (value === null) return;
    const from = this.users[fromLabel];
    const tx = makeTx({
      type: "transfer",
      from: from.address,
      priv: from.priv,
      nonce: this.nextNonce(from.address),
      to: this.users[toLabel].address,
      value,
    });
    this.mempool.push({ tx, note: `${fromLabel} → ${toLabel}: ${amount}` });
  }

  deployToken(): void {
    if (this.tokenAddr) return;
    const from = this.users.alice;
    const nonce = this.nextNonce(from.address);
    const tx = makeTx({
      type: "deploy",
      from: from.address,
      priv: from.priv,
      nonce,
      code: tokenCode,
    });
    this.tokenAddr = predictContractAddress(from.address, nonce);
    this.labels.set(this.tokenAddr, "Token");
    this.mempool.push({ tx, note: "deploy Token (alice là owner)" });
  }

  mintToken(toLabel: UserLabel, amount: string): void {
    if (!this.tokenAddr) return;
    const value = this.parseAmount(amount);
    if (value === null) return;
    const from = this.users.alice; // owner
    const tx = makeTx({
      type: "call",
      from: from.address,
      priv: from.priv,
      nonce: this.nextNonce(from.address),
      to: this.tokenAddr,
      dataArgs: [M_MINT, addrToBig(this.users[toLabel].address), value],
    });
    this.mempool.push({ tx, note: `mint ${amount} token → ${toLabel}` });
  }

  transferToken(
    fromLabel: UserLabel,
    toLabel: UserLabel,
    amount: string,
  ): void {
    if (!this.tokenAddr || fromLabel === toLabel) return;
    const value = this.parseAmount(amount);
    if (value === null) return;
    const from = this.users[fromLabel];
    const tx = makeTx({
      type: "call",
      from: from.address,
      priv: from.priv,
      nonce: this.nextNonce(from.address),
      to: this.tokenAddr,
      dataArgs: [M_TRANSFER, addrToBig(this.users[toLabel].address), value],
    });
    this.mempool.push({
      tx,
      note: `token ${amount}: ${fromLabel} → ${toLabel}`,
    });
  }

  setByzantine(name: string, mode: ByzantineMode): void {
    const v = this.validators.find((x) => x.name === name);
    if (v) v.byzantine = mode;
  }

  clearMempool(): void {
    this.mempool = [];
  }

  mineBlock(): void {
    const captured: string[] = [];
    const res = this.chain.commit(
      this.mempool.map((m) => m.tx),
      {
        validators: this.validators,
        log: (s) => s && captured.push(s.trim()),
      },
    );
    const captureEntries = captured
      .reverse()
      .map((text) => ({ id: this.logSeq++, text }));
    this.log = [...captureEntries, ...this.log].slice(0, 60);
    this.lastTelemetry = res.telemetry;
    this.roundHistory = [...this.roundHistory, res.telemetry].slice(
      -ROUND_HISTORY_SIZE,
    );
    this.roundSeq++;
    if (res.committed) {
      this.labelToken();
      // Tx nào bị loại khỏi block (không đủ số dư, sai nonce...) thì GIỮ LẠI trong mempool
      // và báo rõ lý do - trước đây bị xoá âm thầm, trông như "giao dịch tự nhiên biến mất".
      const rejectedHashes = new Set(res.rejected.map((r) => r.tx.hash));
      for (const r of res.rejected) {
        const note =
          this.mempool.find((m) => m.tx.hash === r.tx.hash)?.note ?? r.tx.type;
        this.pushLog(`✗ bị loại khỏi block - ${note}: ${r.reason}`);
      }
      this.mempool = this.mempool.filter((m) => rejectedHashes.has(m.tx.hash));
    }
    // nếu không chốt: giữ nguyên mempool để người dùng chỉnh (tắt Byzantine...)
  }

  private labelToken(): void {
    for (const [addr, a] of this.chain.state.accounts) {
      if (a.code) {
        this.tokenAddr = addr;
        this.labels.set(addr, "Token");
      }
    }
  }

  // --- snapshot ------------------------------------------------------------
  private decodeTx(tx: Tx): TxView {
    let note = "";
    if (tx.type === "transfer")
      note = `${this.label(tx.from)} → ${this.label(tx.to!)}`;
    else if (tx.type === "deploy") note = `deploy contract`;
    else {
      const method = tx.dataArgs[0];
      if (tx.to === this.tokenAddr && method === M_MINT)
        note = `mint ${formatFixed(tx.dataArgs[2]!)} → ${this.label(bigToAddr(tx.dataArgs[1]!))}`;
      else if (tx.to === this.tokenAddr && method === M_TRANSFER)
        note = `token ${formatFixed(tx.dataArgs[2]!)}: ${this.label(tx.from)} → ${this.label(bigToAddr(tx.dataArgs[1]!))}`;
      else note = `call ${this.label(tx.to!)}`;
    }
    return {
      hash: tx.hash!,
      type: tx.type,
      note,
      value: formatFixed(tx.value),
      nonce: tx.nonce.toString(),
      gas: tx.gasLimit.toString(),
    };
  }

  private blockView(b: Block): BlockView {
    return {
      height: Number(b.header.height),
      hash: b.hash,
      prevHash: b.header.prevHash,
      txRoot: b.header.txRoot,
      stateRoot: b.header.stateRoot,
      proposer: this.label(b.header.proposer),
      timestamp: b.header.timestamp.toString(),
      txCount: b.txs.length,
      commitSigs: b.commit ? b.commit.length : 0,
      txs: b.txs.map((t) => this.decodeTx(t)),
      reward: formatFixed(blockReward(Number(b.header.height))),
    };
  }

  private telemetryView(t: RoundTelemetry): TelemetryView {
    const toVotes = (list: RoundTelemetry["prevotes"]): VoteView[] =>
      list.map((v) => ({
        name: v.name ?? short(v.voter),
        power: Number(v.power),
        voted: v.voted,
        isProposer: v.voter === t.proposer,
      }));
    return {
      seq: this.roundSeq,
      height: t.height,
      proposerName: this.label(t.proposer),
      total: Number(t.totalPower),
      threshold: Number(t.thresholdPower),
      prevote: Number(t.prevotePower),
      precommit: Number(t.precommitPower),
      committed: t.committed,
      prevotes: toVotes(t.prevotes),
      precommits: toVotes(t.precommits),
    };
  }

  private roundHealthView(t: RoundTelemetry): RoundHealthView {
    // Nấc sáng = % quyền biểu quyết đã bầu cho block thật (prevotePower/totalPower),
    // quy về thang 4 nấc - không đếm đầu người, để đúng cả khi validator có power khác
    // nhau (hiện tại 4 validator power bằng nhau nên trùng số, nhưng công thức đúng bản chất).
    const pct =
      t.totalPower > 0n ? Number(t.prevotePower) / Number(t.totalPower) : 0;
    return {
      height: t.height,
      lit: Math.round(pct * 4),
      committed: t.committed,
    };
  }

  /** Luôn trả về đúng ROUND_HISTORY_SIZE phần tử, mới nhất trước; vòng nào chưa xảy ra
   *  (chain còn ngắn) là `null` - UI vẽ ô xám cho các vị trí đó. */
  private buildRoundHistoryGrid(): (RoundHealthView | null)[] {
    const newestFirst = [...this.roundHistory]
      .reverse()
      .map((t) => this.roundHealthView(t));
    const padding: null[] = new Array(
      Math.max(0, ROUND_HISTORY_SIZE - newestFirst.length),
    ).fill(null);
    return [...newestFirst, ...padding];
  }

  snapshot(): SimState {
    const total = this.validators.reduce((n, v) => n + Number(v.power), 0);
    const validatorAddrs = new Set(
      this.validators.map((v) => v.wallet.address),
    );
    // Nhóm: người dùng trước, validator giữa (số dư tăng dần nhờ thưởng block), contract
    // (Token) cuối - thay vì chỉ "contract xuống cuối" như trước, dễ nhìn hơn khi có
    // thêm 4 tài khoản validator.
    const rank = (a: { isContract: boolean; isValidator: boolean }) =>
      a.isContract ? 2 : a.isValidator ? 1 : 0;
    const accounts: AccountView[] = [...this.chain.state.accounts.entries()]
      .map(([addr, a]) => ({
        address: addr,
        label: this.label(addr),
        balance: formatFixed(a.balance),
        nonce: a.nonce.toString(),
        isContract: !!a.code,
        isValidator: validatorAddrs.has(addr),
      }))
      .sort((x, y) =>
        rank(x) === rank(y)
          ? x.label.localeCompare(y.label)
          : rank(x) - rank(y),
      );

    const tokenBalances = this.tokenAddr
      ? (["alice", "bob", "carol"] as UserLabel[]).map((k) => {
          const v = query(this.chain.state, this.tokenAddr!, [
            M_BALANCEOF,
            addrToBig(this.users[k].address),
          ]);
          return { label: k, balance: v === null ? "0" : formatFixed(v) };
        })
      : [];

    return {
      height: this.chain.height,
      headHash: this.chain.head ? this.chain.head.hash : ("0x" as Hex),
      stateRoot: this.chain.state.stateRoot(),
      totalPower: total,
      threshold: Math.floor((total * 2) / 3) + 1,
      validators: this.validators.map((v) => ({
        name: v.name!,
        address: v.wallet.address,
        byzantine: v.byzantine,
      })),
      blocks: this.chain.blocks.map((b) => this.blockView(b)).reverse(), // mới nhất lên đầu
      accounts,
      tokenAddr: this.tokenAddr,
      tokenBalances,
      mempool: this.mempool.map((m) => ({ note: m.note, type: m.tx.type })),
      lastRound: this.lastTelemetry
        ? this.telemetryView(this.lastTelemetry)
        : null,
      roundHistory: this.buildRoundHistoryGrid(),
      log: this.log,
    };
  }
}
