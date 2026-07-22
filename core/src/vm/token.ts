// ---------------------------------------------------------------------------
// token.ts — Hợp đồng token mẫu viết bằng assembly của VM. Số học BigInt.
//   method 1 = transfer(to=ARG1, amount=ARG2)
//   method 2 = balanceOf(addr=ARG1) -> RETURN balance
//   method 3 = mint(to=ARG1, amount=ARG2)  (chỉ owner)
// Owner = người DEPLOY (gán 1 lần trong "constructor", chạy đúng lúc deploy nhờ cờ
// ISCONSTRUCTOR — xem processor.ts). KHÔNG dùng kiểu "ai gọi trước thành owner": cách
// đó có lỗ hổng front-run kinh điển (như vụ Parity multisig 2017) — ai gửi tx gọi
// contract trước deployer 1 nhịp là chiếm quyền owner vĩnh viễn.
// ---------------------------------------------------------------------------
import { assemble } from "./vm";
import type { AsmLine, Program } from "../types/types";

const SLOT_OWNER = 0n;
const SLOT_BAL = 1n;
export const M_TRANSFER = 1n;
export const M_BALANCEOF = 2n;
export const M_MINT = 3n;

const source: readonly AsmLine[] = [
  // Constructor: CHỈ đúng lúc deploy (processor.ts đặt isConstructor=true) mới vào
  // được nhánh này — không tx bên ngoài nào giả mạo được vì đây không phải 1 method
  // trong dispatch, mà là cờ riêng ngoài Tx.
  ["ISCONSTRUCTOR"],
  ["JUMPI", "construct"],

  ["LABEL", "dispatch"],
  ["ARG", 0n],
  ["PUSH", M_TRANSFER],
  ["EQ"],
  ["JUMPI", "do_transfer"],
  ["ARG", 0n],
  ["PUSH", M_BALANCEOF],
  ["EQ"],
  ["JUMPI", "do_balanceof"],
  ["ARG", 0n],
  ["PUSH", M_MINT],
  ["EQ"],
  ["JUMPI", "do_mint"],
  ["REVERT"], // method không hợp lệ

  ["LABEL", "construct"],
  ["CALLER"],
  ["PUSH", SLOT_OWNER],
  ["SSTORE"],
  ["PUSH", 1n],
  ["RETURN"],

  // transfer(to, amount)
  ["LABEL", "do_transfer"],
  ["ARG", 2n],
  ["MSTORE", 0n], // r0 = amount
  ["ARG", 1n],
  ["MSTORE", 1n], // r1 = to
  ["PUSH", SLOT_BAL],
  ["CALLER"],
  ["HASH2"],
  ["MSTORE", 2n], // r2 = key(from)
  ["PUSH", SLOT_BAL],
  ["MLOAD", 1n],
  ["HASH2"],
  ["MSTORE", 3n], // r3 = key(to)
  ["MLOAD", 2n],
  ["SLOAD"],
  ["MSTORE", 4n], // r4 = bal_from
  // require bal_from >= amount  == NOT(bal_from < amount)
  ["MLOAD", 0n],
  ["MLOAD", 4n],
  ["LT"],
  ["ISZERO"],
  ["REQUIRE"],
  // bal_from = bal_from - amount
  ["MLOAD", 0n],
  ["MLOAD", 4n],
  ["SUB"],
  ["MLOAD", 2n],
  ["SSTORE"],
  // bal_to = bal_to + amount
  ["MLOAD", 3n],
  ["SLOAD"],
  ["MLOAD", 0n],
  ["ADD"],
  ["MLOAD", 3n],
  ["SSTORE"],
  ["PUSH", 1n],
  ["RETURN"],

  // balanceOf(addr)
  ["LABEL", "do_balanceof"],
  ["PUSH", SLOT_BAL],
  ["ARG", 1n],
  ["HASH2"],
  ["SLOAD"],
  ["RETURN"],

  // mint(to, amount) — chỉ owner
  ["LABEL", "do_mint"],
  ["CALLER"],
  ["PUSH", SLOT_OWNER],
  ["SLOAD"],
  ["EQ"],
  ["REQUIRE"], // require caller==owner
  ["PUSH", SLOT_BAL],
  ["ARG", 1n],
  ["HASH2"],
  ["MSTORE", 0n], // r0 = key(to)
  ["MLOAD", 0n],
  ["SLOAD"],
  ["ARG", 2n],
  ["ADD"],
  ["MLOAD", 0n],
  ["SSTORE"],
  ["PUSH", 1n],
  ["RETURN"],
];

export const tokenCode: Program = assemble(source);
