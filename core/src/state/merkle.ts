// merkle.ts - Merkle root tất định trên danh sách leaf đã sắp thứ tự.
// Dùng cho txRoot và stateRoot.
import { hash256, toHex } from "../crypto/crypto";
import type { Hex } from "../types/types";

function concat2(a: Uint8Array, b: Uint8Array): Uint8Array {
  const o = new Uint8Array(a.length + b.length);
  o.set(a, 0);
  o.set(b, a.length);
  return o;
}

export function merkleRoot(leavesBytes: Uint8Array[]): Hex {
  if (leavesBytes.length === 0) return toHex(new Uint8Array(32));
  let level = leavesBytes.map((b) => hash256(b));
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = i + 1 < level.length ? level[i + 1]! : left; // nhân đôi node lẻ
      next.push(hash256(concat2(left, right)));
    }
    level = next;
  }
  return toHex(level[0]!);
}
