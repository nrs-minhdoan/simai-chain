// ---------------------------------------------------------------------------
// constants/config.ts - Tham số có thể chỉnh để đổi HÀNH VI của blockchain (không phải
// bất biến thuật toán như ngưỡng BFT power*3 > total*2 - cái đó PHẢI giữ nguyên, xem
// consensus.ts). Đổi giá trị ở đây là đủ, không cần sửa logic ở nơi khác.
// ---------------------------------------------------------------------------
import { parseFixed } from "../fixed-point/fixed-point";

/** Ký hiệu coin gốc của mạng - dùng ở mọi nơi hiển thị số dư/thưởng (demo.ts, explorer)
 *  để tránh mỗi chỗ tự đặt tên khác nhau. */
export const NATIVE_SYMBOL = "SAC";

/** Thưởng coin gốc (SAC) cho validator đề xuất block, giống coinbase của BTC/ETH - cách
 *  duy nhất coin gốc được tạo thêm sau genesis (xem blockReward() ở consensus.ts). */
export const BLOCK_REWARD_BASE = parseFixed("100");

/** Cứ mỗi bao nhiêu block thì thưởng block giảm còn 1 nửa (halving, giống BTC/ETH). */
export const HALVING_INTERVAL = 100_000;

/** Trần tổng cung SAC tuyệt đối - tổng SAC mint được qua blockReward() (xem
 *  consensus.ts) trong suốt lịch sử chain KHÔNG BAO GIỜ được vượt qua số này, dù halving
 *  có chạy bao lâu. (Không tính phần cấp phát genesis đặt trực tiếp qua
 *  WorldState.credit() ngoài blockReward - xem ghi chú ở blockReward()). */
export const MAX_SUPPLY = parseFixed("100000000");

/** Phí cố định cho MỌI giao dịch (transfer/deploy/call như nhau) - bị BURN (huỷ hẳn,
 *  không credit cho proposer hay ai khác), trừ thẳng vào số dư người gửi ở applyTx()
 *  (xem processor.ts). Tính cả khi tx revert (đã tốn tài nguyên xử lý), chỉ MIỄN nếu tx
 *  bị từ chối hẳn (chữ ký/nonce sai, hoặc không đủ để trả phí). */
export const TX_FEE = parseFixed("0.1");

/** Gas limit mặc định khi tx/lệnh gọi không tự khai — dùng chung bởi VM (run()),
 *  processor (query()) và transaction (makeTx()) để tránh mỗi nơi hardcode 1 magic
 *  number khác nhau cho cùng 1 khái niệm. */
export const DEFAULT_GAS_LIMIT = 100000n;
