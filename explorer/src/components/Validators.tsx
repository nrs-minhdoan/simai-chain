import type { TelemetryView, ValidatorView } from "../types/sim";
import type { ByzantineMode } from "@core/types/types";
import Hash from "./common/Hash";

const MODES: { mode: ByzantineMode; label: string }[] = [
  { mode: "none", label: "trung thực" },
  { mode: "equivocate", label: "bỏ phiếu rác" },
  { mode: "silent", label: "im lặng" },
];

type VoteStatus = "waiting" | "voting" | "valid" | "bogus" | "nil";

/** Chấm trạng thái phiếu của 1 validator, tĩnh (không nhấp nháy) như battery-grid.
 *  - "waiting"/"voting" chỉ là nhịp hiển thị lúc đang đề xuất (votingCount đếm dần),
 *    KHÔNG phải kết quả thật — kết quả thật (valid/bogus/nil) chỉ có sau khi
 *    sim.mineBlock() chạy xong, lấy từ lastRound.prevotes.
 *  - "valid"/"bogus"/"nil" là màu khớp đúng với battery-grid: xanh/đỏ/xám. */
function VoteDot({ status }: { status: VoteStatus }) {
  const label =
    status === "waiting"
      ? "Chưa tới lượt"
      : status === "voting"
        ? "Đang bỏ phiếu..."
        : status === "valid"
          ? "Đã bỏ phiếu hợp lệ"
          : status === "bogus"
            ? "Bỏ phiếu rác"
            : "Không bỏ phiếu (im lặng)";
  return <i className={`vote-dot vote-dot-${status}`} title={label} />;
}

export default function Validators({
  validators,
  onSet,
  pending,
  votingCount,
  lastRound,
}: {
  validators: ValidatorView[];
  onSet: (name: string, mode: ByzantineMode) => void;
  pending: boolean;
  votingCount: number;
  lastRound: TelemetryView | null;
}) {
  const faulty = validators.filter((v) => v.byzantine !== "none").length;
  const voteByName = new Map(
    lastRound?.prevotes.map((v) => [v.name, v.voted]) ?? [],
  );
  const statusFor = (index: number, name: string): VoteStatus => {
    if (pending) return index < votingCount ? "voting" : "waiting";
    return voteByName.get(name) ?? "waiting";
  };
  return (
    <div className="validators">
      <p className="hint">
        BFT chịu được &lt; 1/3 node lỗi. Đang lỗi:{" "}
        <b>
          {faulty}/{validators.length}
        </b>
        {faulty >= Math.ceil(validators.length / 3) && (
          <span className="warn-text">
            {" "}
            — vượt ngưỡng, chain có thể dừng đóng block
          </span>
        )}
      </p>
      {validators.map((v, i) => (
        <div key={v.name} className={`validator-row byz-${v.byzantine}`}>
          <div className="validator-id">
            <span className="validator-name-row">
              <VoteDot status={statusFor(i, v.name)} />
              <span className="validator-name">{v.name}</span>
            </span>
            <Hash value={v.address} chars={4} />
          </div>
          <div className="seg">
            {MODES.map((m) => (
              <button
                key={m.mode}
                className={`seg-btn ${v.byzantine === m.mode ? "seg-active" : ""}`}
                onClick={() => onSet(v.name, m.mode)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
