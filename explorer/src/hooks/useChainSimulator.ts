import { useCallback, useMemo, useRef, useState } from "react";
import { ChainSimulator } from "../simulator/chain-simulator";
import type { SimState, UserLabel } from "../types/sim";
import type { ByzantineMode } from "@core/types/types";

export interface Actions {
  addTransfer: (from: UserLabel, to: UserLabel, amount: string) => void;
  deployToken: () => void;
  mintToken: (to: UserLabel, amount: string) => void;
  transferToken: (from: UserLabel, to: UserLabel, amount: string) => void;
  setByzantine: (name: string, mode: ByzantineMode) => void;
  clearMempool: () => void;
  mine: () => Promise<void>;
  reset: () => void;
}

// "Đề xuất" giả lập tốn thời gian - CHỈ ở tầng React, để bạn thật sự thấy giai đoạn
// proposing (viên pin "đang sạc" nhấp nháy, nút Chốt block bị khoá) thay vì chốt tức
// thì. ChainSimulator vẫn đồng bộ 100% (không đụng tới) để giữ đúng như tài liệu
// (gọi action rồi snapshot() ngay) - độ trễ không phải logic mô phỏng, chỉ là nhịp UI.
// Không mô phỏng "độ khó" kiểu proof-of-work (chain này dùng BFT, không có mining) - chỉ
// kéo dài thời gian xác thực/bỏ phiếu để thấy rõ giai đoạn đề xuất đang chạy.
const PROPOSAL_DELAY_MS = 100000;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useChainSimulator(): {
  state: SimState;
  actions: Actions;
  pending: boolean;
  votingCount: number;
} {
  const simRef = useRef<ChainSimulator | null>(null);
  if (simRef.current === null) simRef.current = new ChainSimulator();
  const sim = simRef.current;
  const [state, setState] = useState<SimState>(() => sim.snapshot());
  const [pending, setPending] = useState(false);
  // Trong lúc pending, đếm dần 0 -> số validator để lộ dần từng validator "đã bỏ phiếu"
  // (xem Validators.tsx) thay vì cả 4 hiện cùng lúc lúc kết quả về. Đây CHỈ là nhịp hiển
  // thị, kết quả thật (valid/bogus/nil) vẫn tính 1 lần bởi sim.mineBlock() sau cùng.
  const [votingCount, setVotingCount] = useState(0);
  const pendingRef = useRef(false);
  const refresh = useCallback(() => setState(sim.snapshot()), [sim]);
  const validatorCount = state.validators.length;

  const actions = useMemo<Actions>(
    () => ({
      addTransfer: (f, t, a) => {
        sim.addTransfer(f, t, a);
        refresh();
      },
      deployToken: () => {
        sim.deployToken();
        refresh();
      },
      mintToken: (t, a) => {
        sim.mintToken(t, a);
        refresh();
      },
      transferToken: (f, t, a) => {
        sim.transferToken(f, t, a);
        refresh();
      },
      setByzantine: (n, m) => {
        sim.setByzantine(n, m);
        refresh();
      },
      clearMempool: () => {
        sim.clearMempool();
        refresh();
      },
      mine: async () => {
        if (pendingRef.current) return; // đang đề xuất dở -> bỏ qua lần bấm/tick chồng lên
        pendingRef.current = true;
        setPending(true);
        setVotingCount(0);
        // Rải đều PROPOSAL_DELAY_MS thành từng bước, mỗi bước "lộ" thêm 1 validator đã
        // bỏ phiếu (xem Validators.tsx) - thay vì im lặng suốt rồi hiện cả 4 cùng lúc.
        const steps = Math.max(1, validatorCount);
        const stepMs = PROPOSAL_DELAY_MS / steps;
        for (let i = 1; i <= steps; i++) {
          await sleep(stepMs);
          setVotingCount(i);
        }
        sim.mineBlock();
        pendingRef.current = false;
        setPending(false);
        setVotingCount(0);
        refresh();
      },
      reset: () => {
        sim.reset();
        refresh();
      },
    }),
    [sim, refresh, validatorCount],
  );

  return { state, actions, pending, votingCount };
}
