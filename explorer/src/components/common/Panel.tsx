import type { ReactNode } from "react";
import InfoTip from "./InfoTip";

export default function Panel({
  title,
  eyebrow,
  help,
  children,
  actions,
  fill,
  maxHeight,
}: {
  title: string;
  eyebrow?: string;
  help?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Chiếm đúng maxHeight (px) thay vì cao theo nội dung - dùng khi cần khớp chiều cao
   *  với các panel/cột khác. panel-body trở thành flex:1 để phần còn lại (sau header)
   *  tự co giãn, con bên trong tự lo việc cuộn/virtualize. */
  fill?: boolean;
  maxHeight?: number;
}) {
  return (
    <section
      className={`panel ${fill ? "panel--fill" : ""}`}
      style={fill && maxHeight ? { height: maxHeight } : undefined}
    >
      <header className="panel-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>
            {title}
            {help && <InfoTip text={help} />}
          </h2>
        </div>
        {actions}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
