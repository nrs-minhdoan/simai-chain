# simai-chain

Một **blockchain thu nhỏ nhưng chạy thật** + **explorer trực quan** để xem nó
hoạt động: đồng thuận BFT, máy ảo smart contract tất định, số học BigInt chính
xác tuyệt đối, và bảo mật dựa trên mật mã chứ không dựa vào việc giấu code
(nguyên lý Kerckhoffs - mã nguồn công khai, đảo ngược được, vẫn an toàn).

Đây là **monorepo pnpm** gồm 2 package:

| Package                             | Vai trò                                                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@simai-chain/core`](core)         | Lõi blockchain - thư viện TypeScript **isomorphic** (chạy được cả Node lẫn trình duyệt). Không phụ thuộc API riêng của Node.                                      |
| [`@simai-chain/explorer`](explorer) | Explorer **React + Vite**. Chạy chain **ngay trong trình duyệt** (không cần backend) và hiển thị live: vòng đồng thuận, block, giao dịch, tài khoản, số dư token. |

## Blockchain là gì? (dành cho người chưa biết gì về blockchain)

Không cần biết blockchain trước khi đọc phần còn lại của README - đây là bản dịch
nhanh sang ngôn ngữ đời thường:

- **Blockchain** = một cuốn **sổ kế toán dùng chung**. Thay vì 1 ngân hàng giữ sổ,
  nhiều máy tính (gọi là **validator** - xem bên dưới) mỗi máy giữ 1 bản sao y hệt.
  Đã ghi vào sổ rồi thì không sửa được nữa (mọi thay đổi đều để lại "dấu vết" -
  xem mục "hash" bên dưới).
- **Block** = 1 "trang sổ", ghi lại một nhóm giao dịch xảy ra cùng lúc. Các trang
  nối tiếp nhau bằng cách mỗi trang ghi lại "mã tóm tắt" (hash) của trang trước -
  đó là lý do gọi là "chuỗi khối" (**block-chain**).
- **SAC** = ký hiệu (symbol) của coin gốc trong mạng này, giống BTC của Bitcoin hay ETH
  của Ethereum - đơn vị chuyển giữa alice/bob/carol và cũng là phần thưởng block cho
  validator đề xuất (xem `BLOCK_REWARD_BASE` ở `core/src/constants/config.ts`). Tổng
  cung có **trần tuyệt đối 100 triệu SAC** (`MAX_SUPPLY`) - không bao giờ mint vượt qua
  dù halving chạy bao lâu. Mỗi lần halving (cứ 100.000 block, thưởng giảm 1 nửa), phần
  SAC còn CHƯA được phân phối trong trần đó cũng bị **burn** (huỷ vĩnh viễn) 1 nửa - và
  mọi giao dịch đều mất 1 khoản **phí cố định bị burn** (`TX_FEE`), không ai nhận được
  khoản phí này (không giống phí gas trả cho miner ở nhiều chain khác).
- **Giao dịch (transaction)** = 1 dòng trong sổ: "alice chuyển cho bob 30 SAC".
- **Validator** = các máy tính có quyền xác nhận trang sổ mới. Giống ban kiểm
  phiếu: mỗi validator tự kiểm tra giao dịch có hợp lệ không rồi "bỏ phiếu". Chỉ
  khi **hơn 2/3** validator đồng ý (gọi là đạt **đồng thuận**, hay **consensus**),
  trang mới mới được ghi chính thức. Nhờ vậy dù một số ít validator gian dối hoặc
  mất kết nối (gọi là lỗi kiểu **Byzantine**), cuốn sổ vẫn đúng - đây là ý tưởng
  của **BFT** (Byzantine Fault Tolerance / chịu lỗi Byzantine).
- **Ví (wallet) & địa chỉ** = giống số tài khoản ngân hàng. Mỗi ví có 1
  **khoá riêng** (private key, giữ bí mật - như mật khẩu) và 1 **địa chỉ** suy ra
  từ đó (công khai - như số tài khoản để người khác chuyển tiền tới).
- **Chữ ký số (signature)** = bằng chứng toán học rằng đúng người giữ khoá riêng
  đã tạo ra giao dịch này. Ai không có khoá riêng thì không giả chữ ký được, kể cả
  khi họ đọc toàn bộ mã nguồn (nguyên lý **Kerckhoffs**, xem mục bảo mật bên dưới).
- **Hash** = một hàm toán học biến bất kỳ dữ liệu nào thành 1 chuỗi mã ngắn, cố
  định độ dài, và chỉ cần đổi 1 ký tự trong dữ liệu gốc là hash ra **hoàn toàn
  khác**. Dùng để: (1) phát hiện ai đó sửa dữ liệu sau khi ghi, (2) nối các block
  với nhau (mỗi block chứa hash của block trước).
- **Smart contract** = một đoạn chương trình được lưu và chạy ngay trên
  blockchain, giống 1 "máy bán hàng tự động": ai gọi đúng điều kiện thì nó tự thực
  thi, không ai (kể cả người viết ra nó) can thiệp giữa chừng được. Ví dụ trong dự
  án này: contract **token** - một "ngân hàng mini" tự động quản lý số dư token
  giữa alice/bob/carol.
- **Gas** = "phí xăng" - đơn vị đo công sức tính toán mà 1 giao dịch/smart contract
  tiêu tốn. Dùng để chặn 1 đoạn code chạy vòng lặp vô hạn hoặc spam mạng lưới.

> Muốn xem toàn bộ những khái niệm này diễn ra thật (không chỉ đọc suông): chạy
> `pnpm dev` rồi mở explorer - mỗi panel trong giao diện có icon **?** nhỏ cạnh
> tiêu đề, hover/bấm vào để xem giải thích ngay tại chỗ.

## Yêu cầu

- **Node.js >= 18** (BigInt, ESM, `structuredClone`).
- **pnpm 9** - bật nhanh bằng Corepack (đi kèm Node):
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

| Lệnh             | Việc                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`       | Chạy explorer (dev server, hot reload). Đủ dùng cho phát triển - explorer nạp thẳng mã nguồn `core` qua alias, không cần chạy `core` riêng. |
| `pnpm dev:all`   | Chạy `core` + `explorer` **song song** trong cùng 1 terminal (`pnpm -r --parallel dev`), output gắn nhãn theo từng package.                 |
| `pnpm demo`      | Chạy kịch bản CLI `@simai-chain/core` bằng `tsx`.                                                                                           |
| `pnpm build`     | Build core (esbuild bundle `demo.ts` ra `core/dist/demo.js`) rồi build explorer (ra `explorer/dist/`).                                      |
| `pnpm preview`   | Xem thử bản explorer đã build.                                                                                                              |
| `pnpm typecheck` | Type-check strict cả 2 package.                                                                                                             |

Chạy riêng một package: `pnpm --filter @simai-chain/explorer <script>`.

## Dùng explorer thế nào

Giao diện là một **bảng điều khiển đồng thuận**. Bạn đóng vai người vận hành mạng:

1. **Soạn giao dịch** vào _Mempool_ - chuyển SAC giữa alice / bob / carol,
   deploy contract token, mint hoặc chuyển token.
2. Chỉnh **hành vi validator** (V0–V3): _trung thực_, _bỏ phiếu rác_
   (equivocate), hay _im lặng_ - để mô phỏng node Byzantine.
3. Bấm **Chốt block**. Đồng hồ đồng thuận vẽ quá trình **pre-vote → pre-commit →
   commit** với vạch ngưỡng **> 2/3**; block mới nối vào chuỗi nếu đạt ngưỡng.

Thử: cho **1/4** validator "bỏ phiếu rác" → vẫn chốt (3/4). Cho **2/4** "im lặng"
→ **không chốt**, chain dừng an toàn (đúng tính chất BFT: an toàn khi lỗi < 1/3).

## Mô hình bảo mật (Kerckhoffs)

Toàn bộ mã có thể công khai. An toàn nằm ở những thứ **không phải là code**:

1. **Khoá riêng bí mật** - thiếu key thì không ký được giao dịch/phiếu bầu.
2. **Giả định mật mã** - SHA-256 kháng va chạm, chữ ký secp256k1 khó giả.
3. **Ngưỡng > 2/3** - muốn tấn công phải chiếm > 1/3 quyền biểu quyết _và_ khoá
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

Không có barrel/`index.ts` ở đâu cả - mọi import trỏ thẳng file định nghĩa
symbol, chia theo folder chức năng:

```
simai-chain/
├─ package.json            # script điều phối toàn workspace
├─ pnpm-workspace.yaml     # packages: core, explorer
├─ tsconfig.base.json      # cấu hình TS dùng chung (strict, Bundler resolution)
├─ .prettierrc.json        # format code dùng chung cho cả workspace
├─ README.md
├─ CLAUDE.md               # hướng dẫn cho AI bảo trì/phát triển
├─ core/                   # @simai-chain/core - thư viện blockchain isomorphic
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ build.mjs            # esbuild: bundle demo.ts -> dist/demo.js
│  ├─ demo.ts              # kịch bản CLI, import trực tiếp từng file trong ./src/**
│  └─ src/
│     ├─ constants/config.ts   # NATIVE_SYMBOL, BLOCK_REWARD_BASE, HALVING_INTERVAL, MAX_SUPPLY, TX_FEE
│     ├─ types/types.ts
│     ├─ crypto/{crypto,serialize}.ts
│     ├─ fixed-point/fixed-point.ts
│     ├─ state/{merkle,state}.ts
│     ├─ vm/{vm,token}.ts
│     ├─ transaction/{transaction,processor}.ts
│     ├─ block/block.ts
│     ├─ consensus/consensus.ts
│     └─ chain/chain.ts
└─ explorer/                # @simai-chain/explorer - React + Vite
   ├─ package.json
   ├─ index.html
   ├─ vite.config.ts        # alias @core -> ../core/src (thư mục, không phải 1 file)
   └─ src/
      ├─ main.tsx
      ├─ App.tsx
      ├─ constants/config.ts       # VALIDATOR_COUNT - tham số mô phỏng có thể chỉnh
      ├─ types/{sim.ts,css.d.ts}   # kiểu thuần (SimState...) + declare module "*.css"
      ├─ simulator/chain-simulator.ts           # bộ điều khiển mô phỏng (không phụ thuộc React)
      ├─ hooks/useChainSimulator.ts      # hook React bọc quanh simulator/chain-simulator.ts
      └─ components/
         └─ common/                # primitives dùng chung, KHÔNG barrel
```

Component chỉ export đúng 1 function (vd `Hash`, `Panel`, `ConsensusGauge`)
dùng `export default function X(...)` + `import X from "./X"`. Component export
nhiều hơn 1 (vd `Panels.tsx`) vẫn giữ named export.

Chi tiết từng module và quy ước phát triển: xem [`CLAUDE.md`](CLAUDE.md),
[`core/README.md`](core/README.md), và [`explorer/README.md`](explorer/README.md).
