import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { BlockView } from "../types/sim";
import { NATIVE_SYMBOL, HALVING_INTERVAL } from "@core/constants/config";
import Hash from "./common/Hash";
import Pill from "./common/Pill";

function TxRow({ tx }: { tx: BlockView["txs"][number] }) {
  return (
    <li className="tx-row">
      <Pill
        kind={
          tx.type === "transfer"
            ? "ok"
            : tx.type === "deploy"
              ? "warn"
              : "muted"
        }
      >
        {tx.type}
      </Pill>
      <span className="tx-note">{tx.note}</span>
      {tx.type !== "deploy" && tx.value !== "0" && (
        <span className="tx-val mono">{tx.value}</span>
      )}
      <Hash value={tx.hash} chars={4} />
    </li>
  );
}

function BlockCard({
  b,
  open,
  isNewest,
  onToggle,
}: {
  b: BlockView;
  open: boolean;
  isNewest: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`block-card ${open ? "open" : ""} ${isNewest ? "block-card--new" : ""}`}
    >
      <button className="block-summary" onClick={onToggle}>
        <span className="block-height mono">#{b.height}</span>
        <Hash value={b.hash} chars={5} />
        <span className="block-meta">
          {b.txCount} tx · {b.commitSigs} chữ ký
        </span>
        <span className="block-proposer">{b.proposer}</span>
        <span
          className="block-reward mono"
          title={`Thưởng block cho proposer - giảm nửa mỗi ${HALVING_INTERVAL.toLocaleString("vi-VN")} block`}
        >
          +{b.reward}
        </span>
        <span className="chevron">{open ? "▾" : "▸"}</span>
      </button>
      <div className={`block-detail-wrap ${open ? "open" : ""}`}>
        <div className="block-detail">
          <div className="kv">
            <span>Prev hash</span>
            <Hash value={b.prevHash} />
          </div>
          <div className="kv">
            <span>Tx root</span>
            <Hash value={b.txRoot} />
          </div>
          <div className="kv">
            <span>State root</span>
            <Hash value={b.stateRoot} />
          </div>
          <div className="kv">
            <span>Proposer</span>
            <span>{b.proposer}</span>
          </div>
          <div className="kv">
            <span>Thưởng block</span>
            <span className="mono">
              +{b.reward} {NATIVE_SYMBOL}
            </span>
          </div>
          {b.txs.length > 0 ? (
            <ul className="tx-list">
              {b.txs.map((t) => (
                <TxRow key={t.hash} tx={t} />
              ))}
            </ul>
          ) : (
            <p className="empty">Block rỗng (không có giao dịch).</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chuỗi block có thể rất dài -> chỉ render các thẻ đang thật sự nằm trong khung nhìn
 *  (virtualize), bất kể chain đã cao bao nhiêu. Vì thẻ mở/đóng đổi chiều cao runtime,
 *  cần `measureElement` (đo lại thật sau khi render) thay vì 1 chiều cao cố định giả định. */
export default function Blocks({ blocks }: { blocks: BlockView[] }) {
  const [openH, setOpenH] = useState<number | null>(
    blocks.length ? blocks[0]!.height : null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 6,
    // QUAN TRỌNG: mỗi block mới chốt được unshift lên đầu -> mọi block cũ bị XÔ INDEX
    // (block đang ở index 5 sẽ thành index 6...). Virtualizer mặc định cache chiều cao
    // đã đo THEO INDEX - không có getItemKey, sau mỗi lần xô index nó gán nhầm chiều
    // cao đã đo của 1 block (có thể đang mở, cao) cho block khác vừa trôi vào đúng
    // index đó (thường đang đóng, thấp) -> layout vỡ: hụt/chồng như ảnh. Key theo hash
    // (định danh thật của block) thì cache luôn bám đúng block, bất kể nó trôi tới đâu.
    getItemKey: (index) => blocks[index]!.hash,
  });

  if (blocks.length === 0) {
    return <p className="empty">Chưa có block nào.</p>;
  }

  return (
    <div ref={scrollRef} className="blocks-scroll">
      <div className="blocks" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const b = blocks[vi.index]!;
          return (
            <div
              key={b.hash}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              className="block-row"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <BlockCard
                b={b}
                open={openH === b.height}
                isNewest={vi.index === 0}
                onToggle={() => setOpenH(openH === b.height ? null : b.height)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
