// ---------------------------------------------------------------------------
// constants/config.ts - Tham số cấu hình mô phỏng có thể chỉnh dễ dàng (đổi số
// validator tham gia đồng thuận...). KHÔNG gồm các hằng số chỉ để tạo nhịp hiển thị UI
// (vd PROPOSAL_DELAY_MS ở hooks/useChainSimulator.ts, AUTO_MINE_PAUSE_MS ở App.tsx) -
// những cái đó không phải "cấu hình blockchain", chỉ là tốc độ animation.
// ---------------------------------------------------------------------------

/** Số validator tham gia đồng thuận trong mô phỏng (V0..V{n-1}), mỗi validator power = 1n
 *  nên ngưỡng > 2/3 tự tính lại theo số này (xem snapshot() ở simulator/chain-simulator.ts)
 *  - đổi số ở đây là đủ, không cần sửa gì khác. */
export const VALIDATOR_COUNT = 12;
