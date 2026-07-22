import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POP_WIDTH = 260;
const VIEWPORT_MARGIN = 12;

/** Icon "?" nhỏ - BẤM để mở/đóng 1 popover giải thích bằng ngôn ngữ đời thường.
 *  Popover render qua Portal vào <body> với `position: fixed`, toạ độ tính từ
 *  getBoundingClientRect() của nút - nếu không sẽ bị `.panel { overflow: hidden }`
 *  (và bất kỳ ancestor có overflow nào khác) cắt mất một phần nội dung. */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        r.left + r.width / 2 - POP_WIDTH / 2,
        window.innerWidth - POP_WIDTH - VIEWPORT_MARGIN,
      ),
    );
    setPos({ top: r.bottom + 8, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e: Event) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target))
        return;
      setOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Cuộn/resize làm toạ độ đã tính bị lệch - đóng lại cho an toàn thay vì hiện sai chỗ.
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeIfOutside, true);
    window.addEventListener("resize", closeIfOutside);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeIfOutside, true);
      window.removeEventListener("resize", closeIfOutside);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="info-tip"
        aria-label={text}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className="info-tip-pop"
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: POP_WIDTH }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
