import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 12;

/** Dropdown tự vẽ theo design system (thay <select> gốc trình duyệt) - cùng kỹ thuật
 *  portal + position: fixed như InfoTip (tránh bị `.panel { overflow: hidden }` cắt),
 *  cùng animation pop-in/pop-out (giữ node qua lúc đóng, chờ onAnimationEnd mới unmount -
 *  xem lý do ở InfoTip.tsx). */
export default function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.min(
      r.left,
      window.innerWidth - r.width - VIEWPORT_MARGIN,
    );
    setPos({
      top: r.bottom + 6,
      left: Math.max(VIEWPORT_MARGIN, left),
      width: r.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e: Event) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || listRef.current?.contains(target))
        return;
      setOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
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
        className="xselect"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? `${label}: ${value}` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value}</span>
        <span className={`xselect-chevron ${open ? "open" : ""}`}>▾</span>
      </button>
      {rendered &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-label={label}
            className={`xselect-list ${open ? "" : "closing"}`}
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
            onAnimationEnd={() => {
              if (!open) setRendered(false);
            }}
          >
            {options.map((o) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                className={`xselect-option ${o === value ? "selected" : ""}`}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
