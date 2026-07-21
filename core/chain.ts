// ---------------------------------------------------------------------------
// chain.ts — Bọc quanh consensus: giữ danh sách block + world state, và chốt
// block mới từ mempool. Dùng chung cho CLI demo lẫn explorer React.
// ---------------------------------------------------------------------------
import { WorldState } from "./state";
import {
  runRound,
  type RunRoundParams,
  type RunRoundResult,
} from "./consensus";
import { toHex } from "./crypto";
import type { Block, Tx, Validator, Hex } from "./types";

export class Chain {
  blocks: Block[] = [];
  state = new WorldState();
  constructor(public validators: Validator[]) {}

  get head(): Block | undefined {
    return this.blocks[this.blocks.length - 1];
  }
  get height(): number {
    return this.blocks.length;
  }
  get prevHash(): Hex {
    return this.head ? this.head.hash : toHex(new Uint8Array(32));
  }

  /** Chạy 1 vòng đồng thuận với mempool cho trước; nếu chốt thì nối vào chain. */
  commit(
    mempool: Tx[],
    roundOpts: Partial<RunRoundParams> = {},
  ): RunRoundResult {
    const height = this.blocks.length;
    const res = runRound({
      validators: this.validators,
      height,
      prevHash: this.prevHash,
      preState: this.state,
      mempool,
      log: () => {},
      ...roundOpts,
    });
    if (res.committed) {
      this.blocks.push(res.block);
      this.state = res.postState;
    }
    return res;
  }
}
