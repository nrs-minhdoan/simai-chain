// ---------------------------------------------------------------------------
// vm.ts — Máy ảo cho smart contract. TẤT ĐỊNH tuyệt đối:
//   * chỉ số học BigInt (không float/NaN/Number)
//   * không Date.now / Math.random / thứ tự lặp bất định
//   * ĐO GAS: hết gas -> revert, chặn vòng lặp vô hạn
//   * revert -> hoàn tác mọi thay đổi storage (atomic)
// Production nên nhúng EVM đã audit; ở đây dùng VM minh bạch để THẤY rõ cơ chế.
// ---------------------------------------------------------------------------
import { hexToBytes } from "@noble/hashes/utils";
import { hash256, toHex } from "../crypto/crypto";
import type { Program, AsmLine, OpCode } from "../types/types";

const MASK = (1n << 256n) - 1n; // số học modulo 2^256, như EVM
const wrap = (v: bigint): bigint => ((v % (MASK + 1n)) + (MASK + 1n)) & MASK;

const GAS = {
  base: 1n,
  ADD: 3n,
  SUB: 3n,
  MUL: 5n,
  DIV: 5n,
  MOD: 5n,
  SLOAD: 20n,
  SSTORE: 100n,
  HASH2: 30n,
  JUMP: 8n,
  JUMPI: 10n,
} as const;

class Revert {
  constructor(public reason: string) {}
}

function bytes32(v: bigint): Uint8Array {
  const h = wrap(v).toString(16).padStart(64, "0");
  return hexToBytes(h);
}

/** Ghép 2 giá trị thành 1 khoá storage (dùng cho mapping: slot + address). */
export function mapKey(a: bigint, b: bigint): bigint {
  const combined = new Uint8Array(64);
  combined.set(bytes32(a), 0);
  combined.set(bytes32(b), 32);
  return BigInt(toHex(hash256(combined)));
}

/** Assembler nhỏ: chuyển mã dễ đọc (có nhãn) thành chương trình chạy được. */
export function assemble(lines: readonly AsmLine[]): Program {
  const labels: Record<string, number> = {};
  const prog: AsmLine[] = [];
  for (const line of lines) {
    if (line[0] === "LABEL") {
      labels[line[1] as string] = prog.length;
      continue;
    }
    prog.push(line);
  }
  return prog.map(([op, arg]): { op: OpCode; arg?: bigint } => {
    if ((op === "JUMP" || op === "JUMPI") && typeof arg === "string") {
      if (!(arg in labels))
        throw new Error("VM assemble: nhãn không tồn tại " + arg);
      return { op, arg: BigInt(labels[arg]!) };
    }
    if (arg === undefined) return { op: op as OpCode };
    return {
      op: op as OpCode,
      arg: typeof arg === "bigint" ? arg : BigInt(arg),
    };
  });
}

export interface RunContext {
  caller?: bigint;
  value?: bigint;
  args?: bigint[];
  gasLimit?: bigint;
  storage: Map<bigint, bigint>;
  /** true CHỈ khi processor.ts tự gọi lúc deploy (constructor) — không phải trường
   *  nào trong Tx, nên không tx bên ngoài nào giả mạo được sau khi đã deploy xong. */
  isConstructor?: boolean;
}

export type RunResult =
  | { status: "ok"; ret: bigint; gasUsed: bigint; storage: Map<bigint, bigint> }
  | {
      status: "revert";
      reason: string;
      gasUsed: bigint;
      storage: Map<bigint, bigint>;
    };

export function run(program: Program, ctx: RunContext): RunResult {
  const {
    caller = 0n,
    value = 0n,
    args = [],
    gasLimit = 100000n,
    storage,
    isConstructor = false,
  } = ctx;
  const staged = new Map(storage); // làm việc trên bản sao -> revert = vứt bản sao
  const mem = new Map<number, bigint>(); // thanh ghi tạm (không lưu vào state)
  const stack: bigint[] = [];
  let gas = gasLimit;
  let pc = 0;

  const use = (g: bigint): void => {
    if (gas < g) throw new Revert("out-of-gas");
    gas -= g;
  };
  const pop = (): bigint => {
    const v = stack.pop();
    if (v === undefined) throw new Revert("stack-underflow");
    return v;
  };

  try {
    while (pc < program.length) {
      const ins = program[pc]!;
      const op = ins.op;
      const arg = ins.arg;
      use(GAS.base);
      switch (op) {
        case "PUSH":
          stack.push(wrap(arg!));
          break;
        case "POP":
          pop();
          break;
        case "DUP": {
          const a = pop();
          stack.push(a, a);
          break;
        }
        case "SWAP": {
          const a = pop(),
            b = pop();
          stack.push(a, b);
          break;
        }
        case "ADD":
          use(GAS.ADD);
          stack.push(wrap(pop() + pop()));
          break;
        case "SUB": {
          use(GAS.SUB);
          const a = pop(),
            b = pop();
          stack.push(wrap(a - b));
          break;
        }
        case "MUL":
          use(GAS.MUL);
          stack.push(wrap(pop() * pop()));
          break;
        case "DIV": {
          use(GAS.DIV);
          const a = pop(),
            b = pop();
          stack.push(b === 0n ? 0n : a / b);
          break;
        }
        case "MOD": {
          use(GAS.MOD);
          const a = pop(),
            b = pop();
          stack.push(b === 0n ? 0n : a % b);
          break;
        }
        case "LT": {
          const a = pop(),
            b = pop();
          stack.push(a < b ? 1n : 0n);
          break;
        }
        case "GT": {
          const a = pop(),
            b = pop();
          stack.push(a > b ? 1n : 0n);
          break;
        }
        case "EQ": {
          const a = pop(),
            b = pop();
          stack.push(a === b ? 1n : 0n);
          break;
        }
        case "ISZERO":
          stack.push(pop() === 0n ? 1n : 0n);
          break;
        case "CALLER":
          stack.push(wrap(caller));
          break;
        case "CALLVALUE":
          stack.push(value);
          break;
        case "ISCONSTRUCTOR":
          stack.push(isConstructor ? 1n : 0n);
          break;
        case "ARG": {
          const i = Number(arg);
          if (i >= args.length) throw new Revert("missing-arg");
          stack.push(wrap(args[i]!));
          break;
        }
        case "HASH2": {
          use(GAS.HASH2);
          const a = pop(),
            b = pop();
          stack.push(mapKey(a, b));
          break;
        }
        case "SLOAD": {
          use(GAS.SLOAD);
          const k = pop();
          stack.push(staged.get(k) ?? 0n);
          break;
        }
        case "SSTORE": {
          use(GAS.SSTORE);
          const k = pop(),
            v = pop();
          staged.set(k, wrap(v));
          break;
        }
        case "MSTORE":
          mem.set(Number(arg), pop());
          break;
        case "MLOAD":
          stack.push(mem.get(Number(arg)) ?? 0n);
          break;
        case "JUMP": {
          use(GAS.JUMP);
          pc = Number(arg);
          continue;
        }
        case "JUMPI": {
          use(GAS.JUMPI);
          const cond = pop();
          if (cond !== 0n) {
            pc = Number(arg);
            continue;
          }
          break;
        }
        case "REQUIRE": {
          if (pop() === 0n) throw new Revert("require-failed");
          break;
        }
        case "RETURN":
          return {
            status: "ok",
            ret: pop(),
            gasUsed: gasLimit - gas,
            storage: staged,
          };
        case "STOP":
          return {
            status: "ok",
            ret: 0n,
            gasUsed: gasLimit - gas,
            storage: staged,
          };
        case "REVERT":
          throw new Revert("explicit-revert");
        default:
          throw new Revert("bad-opcode:" + String(op));
      }
      pc++;
    }
    return { status: "ok", ret: 0n, gasUsed: gasLimit - gas, storage: staged };
  } catch (e) {
    if (e instanceof Revert) {
      // revert: hoàn tác toàn bộ, nhưng gas ĐÃ tiêu vẫn mất.
      return {
        status: "revert",
        reason: e.reason,
        gasUsed: gasLimit - gas,
        storage: new Map(storage),
      };
    }
    throw e;
  }
}
