// ---------------------------------------------------------------------------
// consensus.ts — Đồng thuận BFT kiểu Tendermint (mô phỏng trong 1 tiến trình).
// Vòng: PROPOSE -> PRE-VOTE -> PRE-COMMIT -> COMMIT.
// An toàn dựa trên 2 trụ, cả hai KHÔNG cần giấu code:
//   (1) chữ ký không giả mạo được (secp256k1)
//   (2) ngưỡng > 2/3 tổng quyền biểu quyết (chịu < 1/3 node Byzantine)
// ---------------------------------------------------------------------------
import { encode } from "../crypto/serialize";
import {
  hash256,
  sign,
  recoverAddress,
  fromHex,
  toHex,
} from "../crypto/crypto";
import { applyTx } from "../transaction/processor";
import { makeBlock, txRootOf } from "../block/block";
import { WorldState } from "../state/state";
import { parseFixed } from "../fixed-point/fixed-point";
import type {
  Validator,
  Vote,
  VoteStep,
  Block,
  Tx,
  Wallet,
  Hex,
  RoundTelemetry,
  VoteInfo,
} from "../types/types";

/** Thưởng cho validator đề xuất block, giống coinbase của BTC/ETH — cách duy nhất coin
 *  gốc được tạo thêm sau genesis. Giảm còn 1 nửa mỗi HALVING_INTERVAL block (halving). */
export const BLOCK_REWARD_BASE = parseFixed("10");
export const HALVING_INTERVAL = 20;

/** BigInt >> = chia nguyên cho 2^n — đúng kiểu halving thật (BTC cũng làm vậy), tự
 *  tiến về 0 sau đủ nhiều lần halving, không cần xử lý riêng. */
export function blockReward(height: number): bigint {
  const halvings = Math.floor(height / HALVING_INTERVAL);
  return BLOCK_REWARD_BASE >> BigInt(halvings);
}

function voteDigest(
  height: number,
  round: number,
  step: VoteStep,
  blockHash: Hex,
): Uint8Array {
  return hash256(
    encode([BigInt(height), BigInt(round), step, fromHex(blockHash)]),
  );
}

function signVote(
  w: Wallet,
  height: number,
  round: number,
  step: VoteStep,
  blockHash: Hex,
): Vote {
  const { compact, recovery } = sign(
    voteDigest(height, round, step, blockHash),
    w.priv,
  );
  return { voter: w.address, step, blockHash, sig: { compact, recovery } };
}

function verifyVote(
  v: Vote,
  height: number,
  round: number,
  set: Set<Hex>,
): boolean {
  try {
    const d = voteDigest(height, round, v.step, v.blockHash);
    const signer = recoverAddress(d, fromHex(v.sig.compact), v.sig.recovery);
    return signer === v.voter && set.has(v.voter);
  } catch {
    return false;
  }
}

/** Cộng quyền biểu quyết của các phiếu HỢP LỆ bầu cho đúng blockHash. */
function tally(
  votes: Vote[],
  target: Hex,
  powers: Map<Hex, bigint>,
  height: number,
  round: number,
  set: Set<Hex>,
): bigint {
  let power = 0n;
  const counted = new Set<Hex>();
  for (const v of votes) {
    if (v.blockHash !== target) continue;
    if (counted.has(v.voter)) continue; // chống double-count
    if (!verifyVote(v, height, round, set)) continue; // chữ ký giả -> bỏ
    counted.add(v.voter);
    power += powers.get(v.voter) ?? 0n;
  }
  return power;
}

/** Một tx trong mempool bị loại khỏi block đề xuất, kèm lý do (không đủ số dư, sai nonce...). */
export interface RejectedTx {
  tx: Tx;
  reason: string;
}

/** Proposer dựng block từ mempool: chạy thử tx trên bản sao pre-state. */
export function proposeBlock(
  proposer: Wallet,
  height: number,
  prevHash: Hex,
  timestamp: bigint,
  preState: WorldState,
  mempool: Tx[],
): { block: Block; postState: WorldState; rejected: RejectedTx[] } {
  const working = preState.clone();
  const included: Tx[] = [];
  const rejected: RejectedTx[] = [];
  for (const tx of mempool) {
    const r = applyTx(working, tx);
    if (r.ok || r.kind === "call-revert") included.push(tx);
    else rejected.push({ tx, reason: r.error }); // tx sai chữ ký/nonce/không đủ số dư -> bị loại
  }
  // Thưởng block cho proposer — PHẢI tính trước stateRoot, và validateBlock() bên dưới
  // phải làm y hệt bước này, nếu không validator trung thực sẽ tính ra stateRoot khác.
  working.credit(proposer.address, blockReward(height));
  const block = makeBlock({
    height: BigInt(height),
    prevHash,
    txs: included,
    stateRoot: working.stateRoot(),
    proposer: proposer.address,
    timestamp,
  });
  return { block, postState: working, rejected };
}

/** Validator trung thực TỰ chạy lại toàn bộ tx để kiểm tra proposer không nói dối. */
function validateBlock(block: Block, preState: WorldState): boolean {
  if (txRootOf(block.txs) !== block.header.txRoot) return false;
  const working = preState.clone();
  for (const tx of block.txs) {
    const r = applyTx(working, tx);
    if (!(r.ok || r.kind === "call-revert")) return false;
  }
  // Y HỆT bước thưởng trong proposeBlock() — nếu lệch, stateRoot sẽ không khớp và
  // block hợp lệ sẽ bị coi nhầm là gian lận.
  working.credit(
    block.header.proposer,
    blockReward(Number(block.header.height)),
  );
  return working.stateRoot() === block.header.stateRoot;
}

const over2_3 = (v: bigint, total: bigint): boolean => v * 3n > total * 2n;

export interface RunRoundParams {
  validators: Validator[];
  height: number;
  round?: number;
  prevHash: Hex;
  preState: WorldState;
  mempool: Tx[];
  log: (s?: string) => void;
}

export type RunRoundResult =
  | {
      committed: true;
      block: Block;
      postState: WorldState;
      height: number;
      round: number;
      telemetry: RoundTelemetry;
      rejected: RejectedTx[];
    }
  | { committed: false; reason: string; telemetry: RoundTelemetry };

// Trạng thái phiếu của một validator theo cấu hình Byzantine + tính hợp lệ block.
function voteInfoFor(
  v: Validator,
  blockValid: boolean,
): "valid" | "bogus" | "nil" {
  if (v.byzantine === "silent") return "nil";
  if (v.byzantine === "equivocate") return "bogus";
  return blockValid ? "valid" : "nil";
}

export function runRound(p: RunRoundParams): RunRoundResult {
  const { validators, height, round = 0, prevHash, preState, mempool, log } = p;
  const N = validators.length;
  const powers = new Map<Hex, bigint>(
    validators.map((v) => [v.wallet.address, v.power]),
  );
  const set = new Set<Hex>(powers.keys());
  const totalPower = [...powers.values()].reduce((a, b) => a + b, 0n);
  const thresholdPower = (totalPower * 2n) / 3n + 1n; // quyền tối thiểu vượt > 2/3

  const proposer = validators[(height + round) % N]!;
  log(
    `  height ${height} round ${round}: proposer = ${short(proposer.wallet.address)}`,
  );

  const { block, postState, rejected } = proposeBlock(
    proposer.wallet,
    height,
    prevHash,
    BigInt(height),
    preState,
    mempool,
  );
  for (const r of rejected) {
    log(
      `  ✗ tx bị loại khỏi block đề xuất (${short(r.tx.hash!)}): ${r.reason}`,
    );
  }
  const good = block.hash;
  const bogus = toHex(hash256(fromHex(good))); // hash "rác" node xấu bịa ra
  const blockValid = validateBlock(block, preState);

  // Thông tin phiếu để hiển thị (cùng logic cho pre-vote và pre-commit).
  const voteInfos: VoteInfo[] = validators.map((v) => ({
    voter: v.wallet.address,
    name: v.name,
    power: v.power,
    voted: voteInfoFor(v, blockValid),
  }));

  // --- PRE-VOTE ---
  const prevotes: Vote[] = [];
  for (const v of validators) {
    if (v.byzantine === "silent") continue;
    const target =
      v.byzantine === "equivocate" ? bogus : blockValid ? good : null;
    if (target)
      prevotes.push(signVote(v.wallet, height, round, "prevote", target));
  }
  const prevotePower = tally(prevotes, good, powers, height, round, set);
  log(
    `  PRE-VOTE  cho block hợp lệ: ${prevotePower}/${totalPower} quyền biểu quyết`,
  );

  // --- PRE-COMMIT --- (tính trước để telemetry đầy đủ dù có chốt hay không)
  const precommits: Vote[] = [];
  for (const v of validators) {
    if (v.byzantine === "silent") continue;
    const target = v.byzantine === "equivocate" ? bogus : good;
    if (over2_3(prevotePower, totalPower) || v.byzantine === "equivocate") {
      precommits.push(signVote(v.wallet, height, round, "precommit", target));
    }
  }
  const precommitPower = tally(precommits, good, powers, height, round, set);

  const telemetry: RoundTelemetry = {
    height,
    round,
    proposer: proposer.wallet.address,
    totalPower,
    thresholdPower,
    goodHash: good,
    prevotes: voteInfos,
    precommits: voteInfos,
    prevotePower,
    precommitPower,
    committed: false,
  };

  if (!over2_3(prevotePower, totalPower)) {
    log(
      `  ✗ không đạt > 2/3 pre-vote -> KHÔNG chốt (an toàn: không có block xung đột nào commit)`,
    );
    return { committed: false, reason: "no-polka", telemetry };
  }
  log(
    `  PRE-COMMIT cho block hợp lệ: ${precommitPower}/${totalPower} quyền biểu quyết`,
  );
  if (!over2_3(precommitPower, totalPower)) {
    log(`  ✗ không đạt > 2/3 pre-commit -> KHÔNG chốt`);
    return { committed: false, reason: "no-2/3-precommit", telemetry };
  }

  // --- COMMIT --- gắn tập chữ ký pre-commit >2/3 làm bằng chứng chốt.
  block.commit = precommits.filter(
    (pc) => pc.blockHash === good && verifyVote(pc, height, round, set),
  );
  log(
    `  ✓ COMMIT block ${short(block.hash)} với ${block.commit.length} chữ ký pre-commit`,
  );
  return {
    committed: true,
    block,
    postState,
    height,
    round,
    rejected,
    telemetry: { ...telemetry, committed: true },
  };
}

/** Kiểm tra bằng chứng chốt của một block (bên thứ ba xác minh được). */
export function verifyCommit(
  block: Block,
  validators: Validator[],
  height: number,
  round = 0,
): boolean {
  const powers = new Map<Hex, bigint>(
    validators.map((v) => [v.wallet.address, v.power]),
  );
  const set = new Set<Hex>(powers.keys());
  const total = [...powers.values()].reduce((a, b) => a + b, 0n);
  if (!block.commit) return false;
  const power = tally(block.commit, block.hash, powers, height, round, set);
  return power * 3n > total * 2n;
}

export const short = (a: Hex): string => a.slice(0, 8) + "…" + a.slice(-4);
