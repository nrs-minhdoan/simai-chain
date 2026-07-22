// ---------------------------------------------------------------------------
// types/sim.ts - Kiểu dữ liệu thuần (không logic) mà ChainSimulator xuất ra cho React
// render: đã đổi BigInt -> string/number cho an toàn (xem simulator/chain-simulator.ts).
// ---------------------------------------------------------------------------
import type { Hex, ByzantineMode } from "@core/types/types";

export type UserLabel = "alice" | "bob" | "carol";

export interface AccountView {
  address: Hex;
  label: string;
  balance: string;
  nonce: string;
  isContract: boolean;
  isValidator: boolean;
}
export interface TxView {
  hash: Hex;
  type: string;
  note: string;
  value: string;
  nonce: string;
  gas: string;
}
export interface BlockView {
  height: number;
  hash: Hex;
  prevHash: Hex;
  txRoot: Hex;
  stateRoot: Hex;
  proposer: string;
  timestamp: string;
  txCount: number;
  commitSigs: number;
  txs: TxView[];
  /** Thưởng coin gốc (SAC) cho proposer, giảm nửa mỗi HALVING_INTERVAL block (xem
   *  blockReward() ở core/src/consensus/consensus.ts). */
  reward: string;
}
export interface VoteView {
  name: string;
  power: number;
  voted: "valid" | "bogus" | "nil";
  isProposer: boolean;
}
export interface TelemetryView {
  /** Tăng dần mỗi lần chốt block, kể cả khi 2 lần chốt liên tiếp cho ra kết quả y hệt
   *  nhau (vd cùng thất bại) - UI dùng làm key để biết "đây là 1 vòng MỚI" và chạy
   *  lại animation, thay vì so sánh nội dung (có thể trùng nhau giữa 2 vòng khác nhau). */
  seq: number;
  height: number;
  proposerName: string;
  total: number;
  threshold: number;
  prevote: number;
  precommit: number;
  committed: boolean;
  prevotes: VoteView[];
  precommits: VoteView[];
}
export interface ValidatorView {
  name: string;
  address: Hex;
  byzantine: ByzantineMode;
}
export interface MempoolView {
  note: string;
  type: string;
}
/** Sức khoẻ 1 vòng đồng thuận đã xảy ra, dùng để vẽ "viên pin" trong ConsensusGauge.
 *  `lit` = số validator có phiếu bầu tính vào block thật (0-4) - không phải "4 giai
 *  đoạn" (propose/prevote/precommit/commit), vì trong luật hiện tại precommit-đạt-ngưỡng
 *  và commit luôn trùng nhau (không có bước riêng), nên tách "giai đoạn" sẽ ra 2 nấc y
 *  hệt nhau. Đếm theo phiếu THẬT của từng validator mới cho 4 mức phân biệt có ý nghĩa. */
export interface RoundHealthView {
  height: number;
  lit: number;
  committed: boolean;
}
/** id tăng dần & ổn định - log.unshift() làm mọi dòng cũ đổi index, nên UI cần key
 *  theo id (không theo vị trí mảng) để chỉ dòng MỚI có animation "vừa xuất hiện". */
export interface LogEntry {
  id: number;
  text: string;
}
export interface SimState {
  height: number;
  headHash: Hex;
  stateRoot: Hex;
  totalPower: number;
  threshold: number;
  validators: ValidatorView[];
  blocks: BlockView[];
  accounts: AccountView[];
  tokenAddr: Hex | null;
  tokenBalances: { label: string; balance: string }[];
  mempool: MempoolView[];
  lastRound: TelemetryView | null;
  /** 200 vòng gần nhất (mới nhất trước) để vẽ lưới "viên pin" - luôn đúng
   *  ROUND_HISTORY_SIZE phần tử, phần chưa có vòng nào (chain còn ngắn) là `null` (ô
   *  xám, chưa xảy ra). */
  roundHistory: (RoundHealthView | null)[];
  log: LogEntry[];
}
