// ---------------------------------------------------------------------------
// state.ts - Trạng thái toàn cục theo mô hình account.
// stateRoot = merkle của các account sắp theo địa chỉ -> tất định; đổi 1 bit
// nào đó cũng đổi root (phát hiện gian lận).
// ---------------------------------------------------------------------------
import { encode } from "../crypto/serialize";
import { merkleRoot } from "./merkle";
import { fromHex } from "../crypto/crypto";
import type { Account, Hex } from "../types/types";

export class WorldState {
  accounts = new Map<Hex, Account>();

  get(addr: Hex): Account {
    let a = this.accounts.get(addr);
    if (!a) {
      a = {
        balance: 0n,
        nonce: 0n,
        code: null,
        storage: new Map<bigint, bigint>(),
      };
      this.accounts.set(addr, a);
    }
    return a;
  }

  balanceOf(addr: Hex): bigint {
    return this.get(addr).balance;
  }
  credit(addr: Hex, amt: bigint): void {
    this.get(addr).balance += amt;
  }
  debit(addr: Hex, amt: bigint): void {
    const a = this.get(addr);
    if (a.balance < amt) throw new Error("insufficient-balance");
    a.balance -= amt;
  }

  private storageRoot(storage: Map<bigint, bigint>): Hex {
    const leaves = [...storage.entries()]
      .sort((x, y) => (x[0] < y[0] ? -1 : 1))
      .map(([k, v]) => encode([k, v]));
    return merkleRoot(leaves);
  }

  stateRoot(): Hex {
    const leaves = [...this.accounts.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([addr, a]) =>
        encode([
          fromHex(addr),
          a.balance,
          a.nonce,
          a.code ? fromHex(this.storageRoot(a.storage)) : new Uint8Array(0),
          a.code ? BigInt(a.code.length) : 0n,
        ]),
      );
    return merkleRoot(leaves);
  }

  clone(): WorldState {
    const w = new WorldState();
    for (const [addr, a] of this.accounts) {
      w.accounts.set(addr, {
        balance: a.balance,
        nonce: a.nonce,
        code: a.code,
        storage: new Map(a.storage),
      });
    }
    return w;
  }
}
