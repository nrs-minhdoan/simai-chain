// ---------------------------------------------------------------------------
// serialize.ts — Serialization CANONICAL, tất định (KHÔNG dùng JSON).
// Hai node phải ra CÙNG chuỗi byte cho cùng object, nếu không hash sẽ khác ->
// vỡ đồng thuận. Định dạng: [tag(1)][len(4 BE)][payload].
//   0x01 BigInt | 0x02 bytes | 0x03 string | 0x04 array
// ---------------------------------------------------------------------------
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import type { Encodable } from "../types/types";

const TAG = { BIGINT: 1, BYTES: 2, STRING: 3, ARRAY: 4 } as const;

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

function bigToBytes(v: bigint): Uint8Array {
  if (v < 0n) throw new Error("serialize: chỉ hỗ trợ BigInt không âm");
  if (v === 0n) return new Uint8Array([]);
  let hex = v.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return hexToBytes(hex);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function frame(tag: number, payload: Uint8Array): Uint8Array {
  return concat([new Uint8Array([tag]), u32be(payload.length), payload]);
}

export function encode(value: Encodable): Uint8Array {
  if (typeof value === "bigint") return frame(TAG.BIGINT, bigToBytes(value));
  if (value instanceof Uint8Array) return frame(TAG.BYTES, value);
  if (typeof value === "string") return frame(TAG.STRING, utf8ToBytes(value));
  if (Array.isArray(value)) return frame(TAG.ARRAY, concat(value.map(encode)));
  throw new Error(
    "serialize: kiểu không hỗ trợ (cấm Number trong dữ liệu đồng thuận)",
  );
}
