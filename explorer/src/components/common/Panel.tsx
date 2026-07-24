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
  grow,
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
  /** Panel này KHÔNG phải panel duy nhất trong cột (khác trường hợp maxHeight) - thay vào
   *  đó tự "nở" chiếm hết khoảng trống CÒN LẠI của cột (sau các panel khác đã có chiều
   *  cao tự nhiên), miễn cột cha có chiều cao cố định (vd cột phải cũng được ép cao bằng
   *  cột trái - xem App.tsx). Luôn đi cùng `fill` để panel-body cũng tự co giãn theo. */
  grow?: boolean;
}) {
  return (
    <section
      className={`panel ${fill ? "panel--fill" : ""} ${grow ? "panel--grow" : ""}`}
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
