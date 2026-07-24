// ---------------------------------------------------------------------------
// transaction.ts - Giao dịch có chữ ký. Chữ ký ký trên HASH của bản encode
// canonical -> đổi 1 bit thì hash đổi, chữ ký sai. nonce chống replay.
// ---------------------------------------------------------------------------
import { encode } from "../crypto/serialize";
import {
  hash256,
  sign,
  recoverAddress,
  fromHex,
  toHex,
} from "../crypto/crypto";
import { DEFAULT_GAS_LIMIT } from "../constants/config";
import type { Tx, TxType, Program, Hex } from "../types/types";

/** Encode chương trình (deploy) sang bytes tất định để đưa vào hash tx. */
function encodeCode(code: Program | null): Uint8Array {
  if (!code) return new Uint8Array(0);
  const items = code.map((ins) => [
    ins.op,
    ins.arg ?? 0n,
    ins.arg === undefined ? 0n : 1n,
  ]);
  return encode(items);
}

export function txDigest(tx: Tx): Uint8Array {
  const body = [
    tx.type,
    fromHex(tx.from),
    tx.nonce,
    tx.to ? fromHex(tx.to) : new Uint8Array(0),
    tx.value,
    tx.gasLimit,
    encode(tx.dataArgs),
    encodeCode(tx.code),
    tx.memo,
  ];
  return hash256(encode(body));
}

export interface MakeTxParams {
  type: TxType;
  from: Hex;
  priv: Uint8Array;
  nonce: bigint;
  to?: Hex | null;
  value?: bigint;
  gasLimit?: bigint;
  dataArgs?: bigint[];
  code?: Program | null;
  memo?: string;
}

export function makeTx(p: MakeTxParams): Tx {
  const tx: Tx = {
    type: p.type,
    from: p.from,
    nonce: p.nonce,
    to: p.to ?? null,
    value: p.value ?? 0n,
    gasLimit: p.gasLimit ?? DEFAULT_GAS_LIMIT,
    dataArgs: p.dataArgs ?? [],
    code: p.code ?? null,
    memo: p.memo ?? "",
    sig: null,
  };
  const digest = txDigest(tx);
  const { compact, recovery } = sign(digest, p.priv);
  tx.sig = { compact, recovery };
  tx.hash = toHex(digest);
  return tx;
}

/** Xác thực: chữ ký hợp lệ VÀ người ký khôi phục được đúng bằng tx.from. */
export function verifyTx(tx: Tx): boolean {
  try {
    if (!tx.sig) return false;
    const digest = txDigest(tx);
    if (toHex(digest) !== tx.hash) return false; // tx bị sửa sau khi ký
    const signer = recoverAddress(
      digest,
      fromHex(tx.sig.compact),
      tx.sig.recovery,
    );
    return signer === tx.from; // mạo danh -> sai
  } catch {
    return false;
  }
}
