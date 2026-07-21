# chain-sim

Một **blockchain thu nhỏ nhưng chạy thật** + **explorer trực quan** để xem nó
hoạt động: đồng thuận BFT, máy ảo smart contract tất định, số học BigInt chính
xác tuyệt đối, và bảo mật dựa trên mật mã chứ không dựa vào việc giấu code
(nguyên lý Kerckhoffs — mã nguồn công khai, đảo ngược được, vẫn an toàn).

Đây là **monorepo pnpm** gồm 2 package:

| Package | Vai trò |
|---------|---------|
| [`@chain-sim/core`](packages/core) | Lõi blockchain — thư viện TypeScript **isomorphic** (chạy được cả Node lẫn trình duyệt). Không phụ thuộc API riêng của Node. |
| [`@chain-sim/explorer`](packages/explorer) | Explorer **React + Vite**. Chạy chain **ngay trong trình duyệt** (không cần backend) và hiển thị live: vòng đồng thuận, block, giao dịch, tài khoản, số dư token. |

## Yêu cầu

- **Node.js >= 18** (BigInt, ESM, `structuredClone`).
- **pnpm 9** — bật nhanh bằng Corepack (đi kèm Node):
  ```bash
  corepack enable pnpm
  corepack prepare pnpm@9 --activate
  pnpm -v      # kỳ vọng 9.x
  ```

## Chạy nhanh

```bash
pnpm install          # cài dependency cho cả workspace

pnpm dev              # MỞ EXPLORER (Vite) tại http://localhost:5173
pnpm demo             # chạy kịch bản CLI của core (in ra terminal)
```

`pnpm dev` không cần build trước: Vite nạp thẳng mã nguồn TypeScript của core
qua alias, nên sửa core là explorer nóng lại ngay.

### Toàn bộ script (chạy ở thư mục gốc)

| Lệnh | Việc |
|------|------|
| `pnpm dev` | Chạy explorer (dev server, hot reload). |
| `pnpm demo` | Chạy kịch bản CLI `@chain-sim/core` bằng `tsx`. |
| `pnpm build` | Build core (ra `dist/`, kèm `.d.ts`) rồi build explorer (ra `packages/explorer/dist/`). |
| `pnpm preview` | Xem thử bản explorer đã build. |
| `pnpm typecheck` | Type-check strict cả 2 package. |

Chạy riêng một package: `pnpm --filter @chain-sim/explorer <script>`.

## Dùng explorer thế nào

Giao diện là một **bảng điều khiển đồng thuận**. Bạn đóng vai người vận hành mạng:

1. **Soạn giao dịch** vào *Mempool* — chuyển coin giữa alice / bob / carol,
   deploy contract token, mint hoặc chuyển token.
2. Chỉnh **hành vi validator** (V0–V3): *trung thực*, *bỏ phiếu rác*
   (equivocate), hay *im lặng* — để mô phỏng node Byzantine.
3. Bấm **Chốt block**. Đồng hồ đồng thuận vẽ quá trình **pre-vote → pre-commit →
   commit** với vạch ngưỡng **> 2/3**; block mới nối vào chuỗi nếu đạt ngưỡng.

Thử: cho **1/4** validator "bỏ phiếu rác" → vẫn chốt (3/4). Cho **2/4** "im lặng"
→ **không chốt**, chain dừng an toàn (đúng tính chất BFT: an toàn khi lỗi < 1/3).

## Mô hình bảo mật (Kerckhoffs)

Toàn bộ mã có thể công khai. An toàn nằm ở những thứ **không phải là code**:

1. **Khoá riêng bí mật** — thiếu key thì không ký được giao dịch/phiếu bầu.
2. **Giả định mật mã** — SHA-256 kháng va chạm, chữ ký secp256k1 khó giả.
3. **Ngưỡng > 2/3** — muốn tấn công phải chiếm > 1/3 quyền biểu quyết *và* khoá
   của các validator đó.

Explorer minh hoạ trực tiếp: sửa 1 bit trong giao dịch → chữ ký sai; sửa block
đã chốt → hash đổi và tập chữ ký pre-commit không còn khớp.

## Từ simulator lên production

Đây là mô phỏng **một tiến trình** để học và nghiên cứu. Chạy thật cần:

- **VM**: thay VM minh hoạ bằng EVM đã audit (`@ethereumjs/evm`) hoặc runtime WASM có sandbox.
- **Mạng P2P**: `js-libp2p` + gossip, timeout/round thật, xử lý phân mảnh mạng.
- **Lưu trữ state**: Merkle-Patricia Trie trên `level` (LevelDB) thay cho Map trong RAM.
- **Consensus đầy đủ**: luật lock/unlock của Tendermint, evidence + slashing khi double-sign.
- Cân nhắc Go/Rust cho lõi vì hiệu năng và crypto constant-time.

## Cấu trúc thư mục

```
chain-sim/
├─ package.json            # script điều phối toàn workspace
├─ pnpm-workspace.yaml
├─ tsconfig.base.json      # cấu hình TS dùng chung (strict, Bundler resolution)
├─ README.md
├─ CLAUDE.md               # hướng dẫn cho AI bảo trì/phát triển
└─ packages/
   ├─ core/                # @chain-sim/core — thư viện blockchain isomorphic
   │  ├─ src/*.ts
   │  └─ demo.ts           # kịch bản CLI
   └─ explorer/            # @chain-sim/explorer — React + Vite
      ├─ index.html
      ├─ vite.config.ts
      └─ src/
         ├─ sim.ts         # bộ điều khiển mô phỏng (không phụ thuộc React)
         ├─ useChainSim.ts # hook React bọc quanh sim.ts
         ├─ App.tsx
         └─ components/
```

Chi tiết từng module và quy ước phát triển: xem [`CLAUDE.md`](CLAUDE.md).
