# @simai-chain/explorer

Explorer **React + Vite**: chạy `@simai-chain/core` ngay trong trình duyệt (không
backend) và hiển thị live vòng đồng thuận, block, giao dịch, tài khoản, số dư
token. Vai trò của package này chỉ là **điều phối mô phỏng + hiển thị** - mọi
luật blockchain (BFT, VM, chữ ký, state root...) nằm ở [`../core`](../core).

## Cấu trúc & luồng dữ liệu

Không có barrel/`index.ts` - mọi import trỏ thẳng file định nghĩa symbol, chia
theo folder chức năng:

```
explorer/
├─ index.html            # nạp src/main.tsx
├─ vite.config.ts         # alias @core -> ../core/src (thư mục, dev không cần build core)
├─ tsconfig.json           # paths tương ứng, cho tsc/IDE hiểu alias
└─ src/
   ├─ main.tsx             # entry: ReactDOM.createRoot(...).render(<App/>)
   ├─ App.tsx               # bố cục trang, chỉ render - không chứa logic chain
   ├─ styles.css
   ├─ constants/
   │  └─ config.ts          # VALIDATOR_COUNT - tham số mô phỏng có thể chỉnh
   ├─ types/
   │  ├─ sim.ts             # kiểu thuần ChainSimulator xuất ra cho UI (SimState, BlockView...)
   │  └─ css.d.ts           # declare module "*.css" - cho import "./styles.css"
   ├─ simulator/
   │  └─ chain-simulator.ts # điều khiển mô phỏng (class ChainSimulator), KHÔNG phụ thuộc React
   ├─ hooks/
   │  └─ useChainSimulator.ts     # hook React: giữ ChainSimulator trong useRef, snapshot -> useState
   └─ components/           # các panel thuần hiển thị (nhận props, không tự gọi core)
      ├─ common/             # primitives dùng chung, mỗi component 1 file, KHÔNG barrel
      │  ├─ Panel.tsx
      │  ├─ Hash.tsx
      │  ├─ Stat.tsx
      │  ├─ Pill.tsx
      │  └─ InfoTip.tsx
      ├─ ConsensusGauge.tsx  # đồng hồ pre-vote/pre-commit
      ├─ Validators.tsx      # bật/tắt hành vi Byzantine từng validator
      ├─ Controls.tsx        # soạn giao dịch vào mempool
      ├─ Blocks.tsx          # sổ cái block
      └─ Panels.tsx          # Accounts / TokenBalances / LogView
```

**Export mặc định cho component 1 hàm:** mọi file chỉ export đúng 1 function
component (`Panel`, `Hash`, `Stat`, `Pill`, `InfoTip`, `ConsensusGauge`,
`Validators`, `Controls`, `Blocks`) dùng `export default function X(...)`, và
nơi dùng `import X from "./X"` (không dấu `{}`). `Panels.tsx` export 3 component
(`Accounts`, `TokenBalances`, `LogView`) nên vẫn giữ named export như cũ - quy
tắc chỉ áp dụng khi 1 file thật sự chỉ có 1 export.

```
simulator/chain-simulator.ts  ──controls──▶  Chain (@core/chain/chain)
   ▲
   │ snapshot() : SimState (BigInt đã ép sang string/number, kiểu ở types/sim.ts)
hooks/useChainSimulator.ts (hook)
   ▲
   │ { state, actions }
App.tsx + components/ (chỉ render)
```

**Nguyên tắc:** `simulator/chain-simulator.ts` là bộ điều khiển mô phỏng - giữ `Chain`, ví
demo (alice/bob/carol), cấu hình validator, mempool; expose action
(`addTransfer`, `deployToken`, `mintToken`, `mineBlock`...) và `snapshot()` ra
`SimState` (kiểu khai báo ở `types/sim.ts`) thuần chuỗi/số để React render an
toàn. Vì không import React, nó test được bằng `tsx` mà không cần trình duyệt
(xem bên dưới). `hooks/useChainSimulator.ts` chỉ là lớp bọc React (`useRef` giữ
instance, `useState` giữ snapshot). `App.tsx`/`components/` chỉ nhận props và
vẽ - **không** gọi trực tiếp API của core, và import trực tiếp file component
cần dùng (vd `./common/Hash`), không qua barrel.

Import core từ đây luôn qua alias `@core/*` trỏ vào `core/src/*` - chỉ đúng
file thật, vd `import { Chain } from "@core/chain/chain"`,
`import type { ByzantineMode } from "@core/types/types"`.

## Chạy

```bash
pnpm install                    # ở gốc repo
pnpm --filter @simai-chain/explorer dev       # http://localhost:5173, hot reload
pnpm --filter @simai-chain/explorer typecheck
pnpm --filter @simai-chain/explorer build     # ra packages/explorer/dist (production)
pnpm --filter @simai-chain/explorer preview   # xem thử bản build
```

Từ gốc repo: `pnpm dev` / `pnpm build` / `pnpm preview` là alias cho các lệnh trên.

`pnpm dev` **không cần build `core` trước** - Vite nạp thẳng file trong
`../core/src/**` qua alias `@core` trong `vite.config.ts`, nên sửa code trong
`core/` là explorer nóng lại ngay lập tức.

## Dùng explorer thế nào

Giao diện là một **bảng điều khiển đồng thuận**. Bạn đóng vai người vận hành mạng:

1. **Soạn giao dịch** vào _Mempool_ (panel `Controls`) - chuyển SAC (coin gốc, xem
   `NATIVE_SYMBOL` ở `core/src/constants/config.ts`) giữa alice/bob/carol, deploy
   contract token, mint hoặc chuyển token.
2. Chỉnh **hành vi validator** (V0–V3, panel `Validators`): _trung thực_,
   _bỏ phiếu rác_ (equivocate), hay _im lặng_ - mô phỏng node Byzantine.
3. Bấm **Chốt block**. `ConsensusGauge` vẽ quá trình **pre-vote → pre-commit
   → commit** với vạch ngưỡng **> 2/3**; block mới nối vào chuỗi (panel
   `Blocks`) nếu đạt ngưỡng.

Thử: cho **1/4** validator "bỏ phiếu rác" → vẫn chốt (3/4). Cho **2/4** "im
lặng" → **không chốt**, chain dừng an toàn (đúng tính chất BFT: an toàn khi
lỗi < 1/3).

## Test nhanh `ChainSimulator` (không cần trình duyệt)

Vì `simulator/chain-simulator.ts` không phụ thuộc React, có thể lái nó trực tiếp bằng `tsx`:

```bash
cd explorer
cat > /tmp/sim-check.mts <<'EOF'
import { ChainSimulator } from './src/simulator/chain-simulator';
const sim = new ChainSimulator();
sim.addTransfer('alice', 'bob', '10');
sim.mineBlock();
console.log(sim.snapshot().blocks[0]);
EOF
pnpm exec tsx /tmp/sim-check.mts
```

## Mô hình bảo mật (Kerckhoffs)

Explorer minh hoạ trực tiếp các bất biến bảo mật của `@simai-chain/core` (xem
[`../core/README.md`](../core/README.md)): sửa 1 bit trong giao dịch → chữ ký
sai; sửa block đã chốt → hash đổi và tập chữ ký pre-commit không còn khớp.
Không có logic "bí mật" nào nằm ở phía explorer - mọi validate/verify đều chạy
lại trên client bằng đúng code công khai trong `core`.
