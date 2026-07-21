// ---------------------------------------------------------------------------
// crypto.ts — Lớp mật mã. Toàn bộ "sức mạnh bảo mật" nằm ở đây, KHÔNG ở việc
// giấu code (nguyên lý Kerckhoffs). Đọc file này cũng vô dụng nếu thiếu khoá
// riêng và nếu SHA-256/secp256k1 chưa bị phá.
// ---------------------------------------------------------------------------
import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';
import { secp256k1 } from '@noble/curves/secp256k1';
import type { Wallet, Signature, Hex } from './types.js';

export const hash256 = (bytes: Uint8Array): Uint8Array => sha256(bytes);
export const keccak = (bytes: Uint8Array): Uint8Array => keccak_256(bytes);

export const toHex = (b: Uint8Array): Hex => '0x' + Buffer.from(b).toString('hex');
export const fromHex = (h: Hex): Uint8Array =>
  new Uint8Array(Buffer.from(h.replace(/^0x/, ''), 'hex'));

/** Địa chỉ = 20 byte cuối của keccak256(pubkey không nén, bỏ prefix 0x04) — kiểu Ethereum. */
export function addressFromPubKey(pubUncompressed: Uint8Array): Hex {
  return toHex(keccak(pubUncompressed.slice(1)).slice(-20));
}

export function newWallet(): Wallet {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, false);
  return { priv, pub, address: addressFromPubKey(pub) };
}

/** Ký trên hash 32 byte, trả về chữ ký compact + recovery bit. */
export function sign(msgHash: Uint8Array, priv: Uint8Array): Signature {
  const sig = secp256k1.sign(msgHash, priv);
  return { compact: toHex(sig.toCompactRawBytes()), recovery: sig.recovery };
}

/** Từ (hash, chữ ký) khôi phục địa chỉ người ký. Không cần lưu pubkey trong tx. */
export function recoverAddress(msgHash: Uint8Array, compact: Uint8Array, recovery: number): Hex {
  const sig = secp256k1.Signature.fromCompact(compact).addRecoveryBit(recovery);
  const pub = sig.recoverPublicKey(msgHash).toRawBytes(false);
  return addressFromPubKey(pub);
}
