// ---------------------------------------------------------------------------
// types.ts - Kiểu dùng chung cho toàn dự án.
// ---------------------------------------------------------------------------

/** Chuỗi hex có tiền tố 0x (địa chỉ, hash, chữ ký...). */
export type Hex = string;

/** Chữ ký ECDSA compact + recovery bit để khôi phục public key. */
export interface Signature {
  compact: Hex;
  recovery: number;
}

/** Ví: khoá riêng, khoá công khai (không nén) và địa chỉ suy ra. */
export interface Wallet {
  priv: Uint8Array;
  pub: Uint8Array;
  address: Hex;
}

/** Giá trị có thể serialize canonical. */
export type Encodable = bigint | Uint8Array | string | Encodable[];

/** Tập opcode của máy ảo. */
export type OpCode =
  | "PUSH"
  | "POP"
  | "DUP"
  | "SWAP"
  | "ADD"
  | "SUB"
  | "MUL"
  | "DIV"
  | "MOD"
  | "LT"
  | "GT"
  | "EQ"
  | "ISZERO"
  | "CALLER"
  | "CALLVALUE"
  | "ARG"
  | "ISCONSTRUCTOR"
  | "HASH2"
  | "SLOAD"
  | "SSTORE"
  | "MSTORE"
  | "MLOAD"
  | "JUMP"
  | "JUMPI"
  | "REQUIRE"
  | "RETURN"
  | "STOP"
  | "REVERT";

/** Một lệnh đã biên dịch. */
export interface Instruction {
  op: OpCode;
  arg?: bigint;
}

export type Program = Instruction[];

/** Dòng assembly trước khi biên dịch (có thể là nhãn LABEL). */
export type AsmLine = readonly [OpCode | "LABEL", (bigint | string)?];

/** Một tài khoản trong world state. */
export interface Account {
  balance: bigint;
  nonce: bigint;
  code: Program | null;
  storage: Map<bigint, bigint>;
}

export type TxType = "transfer" | "deploy" | "call";

/** Giao dịch có chữ ký. */
export interface Tx {
  type: TxType;
  from: Hex;
  nonce: bigint;
  to: Hex | null;
  value: bigint;
  gasLimit: bigint;
  dataArgs: bigint[];
  code: Program | null;
  sig: Signature | null;
  hash?: Hex;
}

export type VoteStep = "prevote" | "precommit";

/** Phiếu biểu quyết đã ký của một validator. */
export interface Vote {
  voter: Hex;
  step: VoteStep;
  blockHash: Hex;
  sig: Signature;
}

export interface BlockHeader {
  height: bigint;
  prevHash: Hex;
  txRoot: Hex;
  stateRoot: Hex;
  proposer: Hex;
  timestamp: bigint;
}

export interface Block {
  header: BlockHeader;
  txs: Tx[];
  hash: Hex;
  commit: Vote[] | null; // tập chữ ký pre-commit > 2/3
}

export type ByzantineMode = "none" | "silent" | "equivocate";

export interface Validator {
  wallet: Wallet;
  byzantine: ByzantineMode;
  power: bigint;
  name?: string;
}

/** Trạng thái phiếu của một validator trong một vòng - dùng để hiển thị telemetry. */
export interface VoteInfo {
  voter: Hex;
  name?: string;
  power: bigint;
  voted: "valid" | "bogus" | "nil";
}

/** Toàn cảnh một vòng đồng thuận, để UI vẽ đồng hồ pre-vote/pre-commit. */
export interface RoundTelemetry {
  height: number;
  round: number;
  proposer: Hex;
  totalPower: bigint;
  thresholdPower: bigint;
  goodHash: Hex;
  prevotes: VoteInfo[];
  precommits: VoteInfo[];
  prevotePower: bigint;
  precommitPower: bigint;
  committed: boolean;
}
