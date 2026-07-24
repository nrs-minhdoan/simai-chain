// ---------------------------------------------------------------------------
// token.ts - Hợp đồng token mẫu viết bằng assembly của VM. Số học BigInt.
//   method 1 = transfer(to=ARG1, amount=ARG2)
//   method 2 = balanceOf(addr=ARG1) -> RETURN balance
//   method 3 = mint(to=ARG1, amount=ARG2)  (chỉ owner, không vượt maxSupply)
//   method 4 = symbol() -> RETURN symbol đã pack thành bigint (xem packSymbol)
//   method 5 = maxSupply() -> RETURN trần tổng cung
//   method 6 = totalSupply() -> RETURN tổng đã mint tới hiện tại
// Owner = người DEPLOY (gán 1 lần trong "constructor", chạy đúng lúc deploy nhờ cờ
// ISCONSTRUCTOR - xem processor.ts). KHÔNG dùng kiểu "ai gọi trước thành owner": cách
// đó có lỗ hổng front-run kinh điển (như vụ Parity multisig 2017) - ai gửi tx gọi
// contract trước deployer 1 nhịp là chiếm quyền owner vĩnh viễn.
// Constructor nhận đúng 2 tham số qua Tx.dataArgs (processor.ts truyền vào làm args của
// lần run() lúc deploy): ARG0 = symbol đã pack, ARG1 = maxSupply.
// ---------------------------------------------------------------------------
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { assemble } from "./vm";
import type { AsmLine, Program } from "../types/types";

const SLOT_OWNER = 0n;
const SLOT_BAL = 1n;
const SLOT_SYMBOL = 2n;
const SLOT_MAX_SUPPLY = 3n;
const SLOT_TOTAL_SUPPLY = 4n;
export const M_TRANSFER = 1n;
export const M_BALANCEOF = 2n;
export const M_MINT = 3n;
export const M_SYMBOL = 4n;
export const M_MAX_SUPPLY = 5n;
export const M_TOTAL_SUPPLY = 6n;

/** Symbol chỉ để hiển thị (không ảnh hưởng thực thi) - pack thành 1 bigint để lưu
 *  được trong storage của VM (chỉ nhận bigint, không có kiểu string). Cắt bớt còn
 *  TOKEN_SYMBOL_MAX_LEN ký tự trước khi pack, để giá trị lưu không phình quá lớn. */
export const TOKEN_SYMBOL_MAX_LEN = 8;

export function packSymbol(s: string): bigint {
  const bytes = utf8ToBytes(s.slice(0, TOKEN_SYMBOL_MAX_LEN));
  return bytes.length === 0 ? 0n : BigInt("0x" + bytesToHex(bytes));
}

export function unpackSymbol(v: bigint): string {
  if (v === 0n) return "";
  let hex = v.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return new TextDecoder().decode(hexToBytes(hex));
}

const source: readonly AsmLine[] = [
  // Constructor: CHỈ đúng lúc deploy (processor.ts đặt isConstructor=true) mới vào
  // được nhánh này - không tx bên ngoài nào giả mạo được vì đây không phải 1 method
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
  ["ARG", 0n],
  ["PUSH", M_SYMBOL],
  ["EQ"],
  ["JUMPI", "do_symbol"],
  ["ARG", 0n],
  ["PUSH", M_MAX_SUPPLY],
  ["EQ"],
  ["JUMPI", "do_max_supply"],
  ["ARG", 0n],
  ["PUSH", M_TOTAL_SUPPLY],
  ["EQ"],
  ["JUMPI", "do_total_supply"],
  ["REVERT"], // method không hợp lệ

  ["LABEL", "construct"],
  ["CALLER"],
  ["PUSH", SLOT_OWNER],
  ["SSTORE"],
  ["ARG", 0n], // symbol đã pack
  ["PUSH", SLOT_SYMBOL],
  ["SSTORE"],
  ["ARG", 1n], // maxSupply
  ["PUSH", SLOT_MAX_SUPPLY],
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

  // mint(to, amount) - chỉ owner, không vượt maxSupply
  ["LABEL", "do_mint"],
  ["CALLER"],
  ["PUSH", SLOT_OWNER],
  ["SLOAD"],
  ["EQ"],
  ["REQUIRE"], // require caller==owner
  ["PUSH", SLOT_TOTAL_SUPPLY],
  ["SLOAD"],
  ["ARG", 2n],
  ["ADD"],
  ["MSTORE", 5n], // r5 = newTotal = totalSupply + amount
  // require newTotal <= maxSupply  == NOT(maxSupply < newTotal)
  ["MLOAD", 5n],
  ["PUSH", SLOT_MAX_SUPPLY],
  ["SLOAD"],
  ["LT"],
  ["ISZERO"],
  ["REQUIRE"],
  ["MLOAD", 5n],
  ["PUSH", SLOT_TOTAL_SUPPLY],
  ["SSTORE"], // totalSupply = newTotal
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

  // symbol()
  ["LABEL", "do_symbol"],
  ["PUSH", SLOT_SYMBOL],
  ["SLOAD"],
  ["RETURN"],

  // maxSupply()
  ["LABEL", "do_max_supply"],
  ["PUSH", SLOT_MAX_SUPPLY],
  ["SLOAD"],
  ["RETURN"],

  // totalSupply()
  ["LABEL", "do_total_supply"],
  ["PUSH", SLOT_TOTAL_SUPPLY],
  ["SLOAD"],
  ["RETURN"],
];

export const tokenCode: Program = assemble(source);
