// block.ts — Cấu trúc block. Header cam kết txRoot + stateRoot + prevHash.
// blockHash = hash(header). Sửa tx hay số dư nào -> root đổi -> hash đổi.
import { encode } from './serialize.js';
import { hash256, toHex, fromHex } from './crypto.js';
import { merkleRoot } from './merkle.js';
import type { Tx, Block, BlockHeader, Hex } from './types.js';

export function txRootOf(txs: Tx[]): Hex {
  return merkleRoot(txs.map((t) => fromHex(t.hash!)));
}

export function headerDigest(h: BlockHeader): Uint8Array {
  return hash256(
    encode([
      BigInt(h.height),
      fromHex(h.prevHash),
      fromHex(h.txRoot),
      fromHex(h.stateRoot),
      fromHex(h.proposer.length === 42 ? h.proposer : '0x' + '00'.repeat(20)),
      BigInt(h.timestamp),
    ]),
  );
}

export interface MakeBlockParams {
  height: bigint;
  prevHash: Hex;
  txs: Tx[];
  stateRoot: Hex;
  proposer: Hex;
  timestamp: bigint;
}

export function makeBlock(p: MakeBlockParams): Block {
  const header: BlockHeader = {
    height: p.height,
    prevHash: p.prevHash,
    txRoot: txRootOf(p.txs),
    stateRoot: p.stateRoot,
    proposer: p.proposer,
    timestamp: p.timestamp,
  };
  return { header, txs: p.txs, hash: toHex(headerDigest(header)), commit: null };
}
