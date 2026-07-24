import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChainSimulator } from "./hooks/useChainSimulator";
import Panel from "./components/common/Panel";
import Hash from "./components/common/Hash";
import Stat from "./components/common/Stat";
import InfoTip from "./components/common/InfoTip";
import ConsensusGauge from "./components/ConsensusGauge";
import Validators from "./components/Validators";
import Controls from "./components/Controls";
import Blocks from "./components/Blocks";
import { Accounts, TokenBalances, LogView } from "./components/Panels";

// Nghỉ ngắn SAU KHI 1 block đã đóng xong, trước khi đề xuất block tiếp theo - đủ để
// mắt kịp thấy màu xanh "đã đóng" trước khi vòng mới bắt đầu.
const AUTO_MINE_PAUSE_MS = 500;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function App() {
  const { state, actions, pending, votingCount } = useChainSimulator();
  const [showIntro, setShowIntro] = useState(true);
  const [autoMine, setAutoMine] = useState(false);

  // "Chạy tự động": lặp lại đóng block liên tục, giống toàn bộ validator (V0..V{n-1},
  // n = VALIDATOR_COUNT) đang hoạt động liên tục thay vì chỉ khi bạn tự bấm - không cần
  // mở nhiều máy/tiến trình thật, tất cả đã "bỏ phiếu" ngay trong 1 tiến trình mỗi vòng.
  // QUAN TRỌNG: đây là vòng lặp TỰ CHỜ actions.mine() xong (bao gồm cả độ trễ đề xuất
  // PROPOSAL_DELAY_MS trong useChainSimulator.ts) rồi mới nghỉ AUTO_MINE_PAUSE_MS và lặp tiếp
  // - KHÔNG dùng setInterval cố định nữa, vì trước đây interval (2500ms) chạy độc lập
  // với thời gian đề xuất thật (1100ms), nên phần lớn mỗi chu kỳ chỉ thấy trạng thái đã
  // xong, giai đoạn "đang đề xuất" bị lướt qua rất nhanh, không rõ. Giờ nhịp auto-mine
  // hoàn toàn theo đúng tốc độ đề xuất thật - tăng PROPOSAL_DELAY_MS là auto-mine tự
  // chậm theo, không cần chỉnh 2 chỗ.
  useEffect(() => {
    if (!autoMine) return;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        await actions.mine();
        if (cancelled) return;
        await sleep(AUTO_MINE_PAUSE_MS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoMine, actions]);

  // Chuỗi block có thể dài hơn cột trái/phải rất nhiều (virtualize + cuộn riêng) -
  // đo chiều cao thật của 2 cột kia để panel "Chuỗi block" cao đúng bằng cột cao
  // nhất, nhờ vậy border-bottom của cả 3 cột thẳng hàng nhau thay vì lệch tuỳ nội dung.
  const colLeftRef = useRef<HTMLDivElement>(null);
  const colRightRef = useRef<HTMLDivElement>(null);
  const [centerMaxHeight, setCenterMaxHeight] = useState<number | undefined>(
    undefined,
  );

  useLayoutEffect(() => {
    const left = colLeftRef.current;
    const right = colRightRef.current;
    if (!left || !right) return;
    const recompute = () => {
      setCenterMaxHeight(Math.max(left.offsetHeight, right.offsetHeight));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(left);
    ro.observe(right);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>simai-chain</h1>
            <span className="brand-sub">bộ mô phỏng blockchain BFT</span>
          </div>
        </div>
        <span className="topbar-divider" aria-hidden />
        <div className="topstats">
          <Stat label="height" value={state.height} mono />
          <Stat
            label="head"
            value={<Hash value={state.headHash} chars={5} />}
          />
          <Stat
            label="state root"
            value={<Hash value={state.stateRoot} chars={5} />}
          />
          <Stat label="validator" value={state.validators.length} mono />
        </div>
        <div className="topactions">
          <button
            className={`btn ${autoMine ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setAutoMine((v) => !v)}
            title={`Tự động đóng block mỗi vài giây, mô phỏng mạng chạy liên tục với ${state.validators.length} validator luôn bỏ phiếu`}
          >
            {autoMine && <span className="live-dot" aria-hidden />}
            {autoMine ? "Đang chạy tự động" : "Chạy tự động"}
          </button>
          <button
            className={`btn btn-mine ${pending ? "btn-fault" : "btn-primary"}`}
            onClick={actions.mine}
            disabled={pending || autoMine}
          >
            {pending && <span className="live-dot" aria-hidden />}
            {pending ? "Đang đề xuất…" : "Đóng block"}
          </button>
          <button className="btn btn-ghost" onClick={actions.reset}>
            Đặt lại
          </button>
        </div>
      </header>

      <div className={`intro ${showIntro ? "open" : ""}`}>
        <button
          className="intro-toggle"
          onClick={() => setShowIntro((v) => !v)}
        >
          <span>💡 Chưa biết blockchain là gì?</span>
          <span className="chevron">{showIntro ? "▾" : "▸"}</span>
        </button>
        <div className={`intro-body ${showIntro ? "open" : ""}`}>
          <p>
            Hình dung {state.validators.length} máy tính (<b>validator</b>) cùng
            giữ chung 1 cuốn sổ kế toán không ai sửa được sau khi ghi - đó là{" "}
            <b>blockchain</b>. Mỗi "trang sổ" là 1 <b>block</b>. Trước khi thêm
            trang mới, các validator phải biểu quyết đồng ý (<b>đồng thuận</b>)
            - cần ít nhất 2/3 số phiếu, nên dù vài validator gian dối hoặc mất
            kết nối, cuốn sổ vẫn đúng. Bấm <b>Đóng block</b> để tự đóng 1 lần,
            hoặc <b>Chạy tự động</b> để xem cả {state.validators.length}{" "}
            validator liên tục bỏ phiếu như 1 mạng thật đang chạy.
          </p>
        </div>
      </div>

      <section className="hero">
        <span className="eyebrow">
          Vòng đồng thuận gần nhất
          <InfoTip
            text={
              "Mỗi ô là 1 block, vẽ như 1 viên pin 4 nấc - nấc sáng = số validator có phiếu bầu tính vào block đó (0-4). Khi đang đề xuất, các validator KHÔNG bỏ phiếu cùng lúc nên nấc pin sáng dần từng nấc một theo từng validator. Đủ hơn 2/3 phiếu (từ 3/4 trở lên) thì đóng block xong, pin chuyển XANH. Chưa đủ thì pin ĐỎ. Ô XÁM là vị trí chưa đóng block."
            }
          />
        </span>
        <ConsensusGauge
          t={state.lastRound}
          history={state.roundHistory}
          pending={pending}
          votingCount={votingCount}
          validatorCount={state.validators.length}
        />
      </section>

      <main className="grid">
        <div className="col col-left" ref={colLeftRef}>
          <Panel
            eyebrow="trình xác thực"
            title="Validator"
            help="Validator là các máy tính chịu trách nhiệm kiểm tra và bỏ phiếu xác nhận block mới - giống ban kiểm phiếu trong 1 cuộc bầu cử. Bạn có thể ép 1 validator gian dối (bỏ phiếu rác) hoặc mất kết nối (im lặng) để xem hệ thống vẫn an toàn ra sao."
          >
            <Validators
              validators={state.validators}
              onSet={actions.setByzantine}
              pending={pending}
              votingCount={votingCount}
              lastRound={state.lastRound}
            />
          </Panel>
          <Panel
            eyebrow="soạn giao dịch"
            title="Mempool"
            help="Mempool là hàng đợi các giao dịch đã tạo nhưng chưa được ghi vào block nào - giống giỏ hàng chờ thanh toán. Khi bạn bấm 'Đóng block', mọi giao dịch trong mempool sẽ được gom vào 1 block mới (nếu đủ phiếu đồng thuận)."
          >
            <Controls
              mempool={state.mempool}
              tokenReady={!!state.tokenAddr}
              onDeploy={!!state.tokenAddr}
              actions={actions}
            />
          </Panel>
        </div>

        <div className="col col-center">
          <Panel
            eyebrow="sổ cái"
            title="Chuỗi block"
            actions={<span className="count">{state.height} block</span>}
            help="Đây là cuốn sổ chính: mỗi thẻ là 1 block (1 trang sổ) đã được các validator đồng thuận đóng, nối tiếp block trước bằng 'prevHash'. Bấm vào 1 block để xem chi tiết giao dịch bên trong và các mã hash dùng để phát hiện gian lận."
            fill
            maxHeight={centerMaxHeight}
          >
            <Blocks blocks={state.blocks} />
          </Panel>
        </div>

        <div
          className="col col-right"
          ref={colRightRef}
          style={centerMaxHeight ? { height: centerMaxHeight } : undefined}
        >
          <Panel
            eyebrow="trạng thái"
            title="Tài khoản"
            help="Mỗi tài khoản giống 1 số tài khoản ngân hàng, xác định bằng địa chỉ (chuỗi mã hoá) thay vì tên - chủ sở hữu chứng minh quyền sở hữu bằng chữ ký số (khoá riêng), không cần CMND. 'nonce' đếm số giao dịch tài khoản đã gửi, dùng để chặn gửi lại giao dịch cũ (replay)."
          >
            <Accounts accounts={state.accounts} />
          </Panel>
          <Panel
            eyebrow="SRC-20"
            title="Số dư token"
            actions={
              state.tokenAddr ? (
                <Hash value={state.tokenAddr} chars={4} />
              ) : undefined
            }
            help="Token ở đây là 1 smart contract mẫu - một đoạn chương trình tự chạy trên blockchain, đóng vai trò như 1 'ngân hàng mini' tự động quản lý số dư, không cần người vận hành ở giữa."
          >
            <TokenBalances
              token={state.tokenBalances}
              symbol={state.tokenSymbol}
              maxSupply={state.tokenMaxSupply}
              totalSupply={state.tokenTotalSupply}
            />
          </Panel>
          <Panel
            eyebrow="nhật ký"
            title="Consensus log"
            help="Nhật ký từng bước của quá trình đồng thuận (ai đề xuất block, kết quả bỏ phiếu...) - đọc để theo dõi 'hộp đen' đồng thuận đang làm gì ở mỗi lần đóng block."
            fill
            grow
          >
            <LogView log={state.log} />
          </Panel>
        </div>
      </main>

      <footer className="foot">
        <span>
          Bảo mật dựa trên chữ ký secp256k1 + ngưỡng &gt; 2/3, không dựa vào
          việc giấu code (Kerckhoffs).
        </span>
      </footer>
    </div>
  );
}
