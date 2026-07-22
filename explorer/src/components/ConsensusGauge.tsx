import { useLayoutEffect, useRef, useState } from "react";
import type { RoundHealthView, TelemetryView } from "../types/sim";

// Phải khớp đúng CSS của .battery-grid (grid-template-columns: minmax(BATTERY_MIN_WIDTH,1fr), gap)
// để tính đúng số cột sẽ thật sự render, từ đó suy ra tổng số ô cần cho đủ 5 hàng.
const BATTERY_MIN_WIDTH = 26;
const BATTERY_GAP = 5;
const ROWS = 5;

/** Vòng đang đề xuất/vote NGAY LÚC NÀY — `lit` đếm theo `votingCount` (xem
 *  useChainSimulator.ts), tăng dần từng validator một thay vì nhảy thẳng lên
 *  4/4 khi có kết quả, để khớp với việc validator bỏ phiếu KHÔNG đồng thời. */
interface PendingSlot {
  pending: true;
  lit: number;
}

type BatterySlot = RoundHealthView | null | PendingSlot;

/** 1 block = 1 "viên pin" 4 nấc tĩnh (không nhấp nháy). Nấc sáng = % quyền biểu quyết
 *  đã bầu cho block thật, quy về thang 4 (xem roundHealthView() ở sim.ts) — không phải
 *  "4 giai đoạn" propose/prevote/precommit/commit, vì luật hiện tại precommit-đạt-ngưỡng
 *  và commit luôn xảy ra cùng lúc nên 2 "giai đoạn" đó sẽ luôn y hệt nhau.
 *  Xanh = đã đóng block. Đỏ = đang vote/chưa đủ phiếu (gồm cả vòng đang đề xuất ngay lúc
 *  này). Xám = ô này chưa đóng block (chain còn ngắn hơn số ô lưới). */
function Battery({ slot }: { slot: BatterySlot }) {
  if (slot && "pending" in slot) {
    return (
      <div
        className="battery battery-charging"
        title={`Đang đề xuất & vote block mới... (${slot.lit}/4 phiếu)`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`battery-notch ${i < slot.lit ? "filled" : ""}`}
          />
        ))}
      </div>
    );
  }
  if (!slot) {
    return (
      <div
        className="battery battery-empty"
        title="Chưa có block ở vị trí này"
        aria-hidden
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="battery-notch" />
        ))}
      </div>
    );
  }
  const statusText = slot.committed ? "ĐÃ ĐÓNG BLOCK" : "ĐANG VOTE";
  return (
    <div
      className={`battery ${slot.committed ? "battery-ok" : "battery-charging"}`}
      title={`Block #${slot.height} · ${slot.lit}/4 phiếu · ${statusText}`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`battery-notch ${i < slot.lit ? "filled" : ""}`}
        />
      ))}
    </div>
  );
}

export default function ConsensusGauge({
  t,
  history,
  pending,
  votingCount,
  validatorCount,
}: {
  t: TelemetryView | null;
  history: (RoundHealthView | null)[];
  pending: boolean;
  /** Số validator đã "lộ" phiếu trong vòng đang đề xuất (xem useChainSimulator.ts) —
   *  dùng để lấp dần nấc pin thay vì để trống suốt tới khi có kết quả. */
  votingCount: number;
  validatorCount: number;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Không cố định số ô nữa — đo bề rộng thật của lưới, suy ra số cột vừa khít, rồi luôn
  // hiển thị đủ ROWS (5) hàng thay vì 1 tổng cố định (trước là 200 dù màn rộng/hẹp thế nào).
  const [columns, setColumns] = useState(10);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const recompute = () => {
      const cols = Math.max(
        1,
        Math.floor(
          (el.clientWidth + BATTERY_GAP) / (BATTERY_MIN_WIDTH + BATTERY_GAP),
        ),
      );
      setColumns(cols);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slotCount = columns * ROWS;
  // history (từ sim.ts) mới nhất trước, đệm null ở cuối cho đủ ROUND_HISTORY_SIZE. Lấy
  // đúng slotCount phần tử gần nhất rồi ĐẢO NGƯỢC -> thứ tự thời gian (cũ -> mới), nhờ
  // vậy null (chưa đủ lịch sử) tự dồn về ĐẦU và block mới nhất luôn nằm CUỐI lưới.
  const takeCount = pending ? slotCount - 1 : slotCount;
  const chronological: BatterySlot[] = [
    ...history.slice(0, takeCount),
  ].reverse();
  // Đang đề xuất -> thêm 1 ô "sống" ở CUỐI (đại diện vòng đang chạy ngay lúc này, sắp
  // trở thành mới nhất), giữ tổng luôn đúng slotCount. Nấc sáng của ô này tăng dần theo
  // votingCount (số validator đã "bỏ phiếu" tính tới lúc này) quy về thang 4 — cùng công
  // thức với roundHealthView() ở sim.ts — để pin thể hiện đúng việc validator vote KHÔNG
  // đồng thời, thay vì đứng yên 0/4 suốt rồi nhảy thẳng lên khi có kết quả.
  const pendingLit =
    validatorCount > 0 ? Math.round((votingCount / validatorCount) * 4) : 0;
  const slots: BatterySlot[] = pending
    ? [...chronological, { pending: true, lit: pendingLit }]
    : chronological;

  return (
    <div className="gauge">
      {t ? (
        <div key={t.seq} className="gauge-status">
          <span className="gauge-meta mono">
            height {t.height} · proposer {t.proposerName} · vòng gần nhất{" "}
            {t.prevote}/{t.total} phiếu
            {t.committed ? " · đã đóng block" : " · đang vote"}
          </span>
        </div>
      ) : (
        <p className="gauge-empty-text">
          Chưa có vòng đồng thuận nào. Thêm giao dịch vào mempool rồi bấm{" "}
          <b>Đóng block</b> để xem.
        </p>
      )}
      <div ref={gridRef} className="battery-grid">
        {slots.map((s, i) => (
          <Battery
            key={s && "pending" in s ? "pending" : s ? s.height : `empty-${i}`}
            slot={s}
          />
        ))}
      </div>
      <div className="battery-legend">
        <span>
          <i className="dot battery-dot-ok" />
          Đã đóng block
        </span>
        <span>
          <i className="dot battery-dot-charging" />
          Đang vote
        </span>
        <span>
          <i className="dot battery-dot-empty" />
          Chưa đóng block
        </span>
      </div>
    </div>
  );
}
