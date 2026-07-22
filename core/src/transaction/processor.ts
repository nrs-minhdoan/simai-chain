// ---------------------------------------------------------------------------
// processor.ts — Luật chuyển trạng thái từ 1 giao dịch. Mọi node chạy y hệt ->
// ra state root y hệt. Thứ tự: chữ ký -> nonce -> số dư -> thực thi.
// ---------------------------------------------------------------------------
import { hexToBytes } from "@noble/hashes/utils";
import { verifyTx } from "./transaction";
import { run } from "../vm/vm";
import { hash256, toHex, fromHex } from "../crypto/crypto";
import type { WorldState } from "../state/state";
import type { Tx, Hex } from "../types/types";

export type ApplyResult =
  | { ok: true; kind: "transfer" }
  | { ok: true; kind: "deploy"; contract: Hex }
  | { ok: true; kind: "call"; ret: bigint; gasUsed: bigint }
  | { ok: false; kind?: "call-revert"; error: string; gasUsed?: bigint };

/** Địa chỉ contract khi deploy = hash(from || nonce), tất định. Dự đoán được TRƯỚC khi
 *  block chốt (dùng bởi UI để hiển thị địa chỉ contract sắp deploy). */
export function predictContractAddress(from: Hex, nonce: bigint): Hex {
  const b = new Uint8Array(28);
  b.set(fromHex(from), 0);
  const nb = nonce.toString(16).padStart(16, "0");
  b.set(hexToBytes(nb), 20);
  return toHex(hash256(b).slice(-20));
}

export function applyTx(state: WorldState, tx: Tx): ApplyResult {
  if (!verifyTx(tx))
    return { ok: false, error: "chữ ký không hợp lệ / tx bị sửa" };

  const sender = state.get(tx.from);
  if (tx.nonce !== sender.nonce)
    return {
      ok: false,
      error: `nonce sai (mong đợi ${sender.nonce}, nhận ${tx.nonce}) — có thể là replay`,
    };

  if (tx.type === "transfer") {
    if (!tx.to) return { ok: false, error: "thiếu địa chỉ đích" };
    if (sender.balance < tx.value)
      return { ok: false, error: "không đủ số dư" };
    state.debit(tx.from, tx.value);
    state.credit(tx.to, tx.value);
    sender.nonce += 1n;
    return { ok: true, kind: "transfer" };
  }

  if (tx.type === "deploy") {
    if (!tx.code) return { ok: false, error: "thiếu code" };
    if (sender.balance < tx.value)
      return { ok: false, error: "không đủ số dư để gửi value" };
    const addr = predictContractAddress(tx.from, tx.nonce);
    const acct = state.get(addr);
    // "Constructor": chạy code 1 lần NGAY LÚC DEPLOY với caller = người deploy và cờ
    // isConstructor — cờ này KHÔNG nằm trong Tx nên không tx nào sau đó giả mạo lại
    // được, tránh lỗ hổng "ai gọi contract trước cũng có thể tự nhận làm owner"
    // (kiểu lỗi Parity multisig 2017: contract chưa khởi tạo, ai init trước là chủ).
    const result = run(tx.code, {
      caller: BigInt(tx.from),
      value: tx.value,
      args: [],
      gasLimit: tx.gasLimit,
      storage: acct.storage,
      isConstructor: true,
    });
    sender.nonce += 1n;
    if (result.status !== "ok") {
      return {
        ok: false,
        kind: "call-revert",
        error: "revert (constructor): " + result.reason,
        gasUsed: result.gasUsed,
      };
    }
    acct.code = tx.code;
    acct.storage = result.storage;
    if (tx.value > 0n) {
      state.debit(tx.from, tx.value);
      state.credit(addr, tx.value);
    }
    return { ok: true, kind: "deploy", contract: addr };
  }

  // call
  if (!tx.to) return { ok: false, error: "thiếu địa chỉ đích" };
  const acct = state.get(tx.to);
  if (!acct.code) return { ok: false, error: "đích không phải contract" };
  if (sender.balance < tx.value)
    return { ok: false, error: "không đủ số dư để gửi value" };

  const result = run(acct.code, {
    caller: BigInt(tx.from),
    value: tx.value,
    args: tx.dataArgs,
    gasLimit: tx.gasLimit,
    storage: acct.storage,
  });

  sender.nonce += 1n; // nonce tăng dù revert (đã tốn gas), giống Ethereum
  if (result.status === "ok") {
    acct.storage = result.storage; // commit
    if (tx.value > 0n) {
      state.debit(tx.from, tx.value);
      state.credit(tx.to, tx.value);
    }
    return { ok: true, kind: "call", ret: result.ret, gasUsed: result.gasUsed };
  }
  return {
    ok: false,
    kind: "call-revert",
    error: "revert: " + result.reason,
    gasUsed: result.gasUsed,
  };
}

/** Đọc read-only (không đổi state, không cần nonce/chữ ký) — như eth_call. */
export function query(
  state: WorldState,
  contractAddr: Hex,
  args: bigint[],
  gasLimit = 100000n,
): bigint | null {
  const acct = state.get(contractAddr);
  if (!acct.code) return null;
  const r = run(acct.code, {
    caller: 0n,
    value: 0n,
    args,
    gasLimit,
    storage: acct.storage,
  });
  return r.status === "ok" ? r.ret : null;
}
