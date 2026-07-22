# CLAUDE.md

Hướng dẫn cho AI (và người) bảo trì, phát triển repo này. Đọc trước khi sửa code.

## 1. Dự án là gì

`simai-chain` là blockchain mô phỏng **chạy thật** + explorer React. Mục tiêu là
minh hoạ **chính xác và trung thực** 4 điều: đồng thuận BFT, smart contract tất
định, số học chính xác, và bảo mật kiểu Kerckhoffs (công khai code vẫn an toàn).
Ưu tiên **sự đúng đắn và rõ ràng** hơn hiệu năng. Đây là công cụ học tập/nghiên
cứu, KHÔNG phải blockchain production - đừng thêm tính năng làm mờ các bất biến bên dưới.

## 2. Bố cục & luồng dữ liệu

```
core/src/** (thư viện thuần, isomorphic, chia theo folder chức năng)
        ▲                         ▲
        │ import qua alias @core  │ import path thật (../src/...)
        │  → đúng file, vd        │
        │  '@core/chain/chain'    │
explorer/src/simulator/chain-simulator.ts    core/demo.ts (CLI)
   (điều khiển mô phỏng)
        ▲
        │
explorer/src/hooks/useChainSimulator.ts (hook React: giữ ChainSimulator trong useRef, snapshot → useState)
        ▲
        │
explorer/src/App.tsx + components/ (chỉ render, không chứa logic chain)
```

**Nguyên tắc phân tầng:** mọi logic blockchain nằm ở `core`. Logic điều phối mô
phỏng (mempool, nhãn địa chỉ, dựng snapshot) nằm ở `explorer/src/simulator/chain-simulator.ts` -
**không phụ thuộc React** nên test được bằng `tsx`. Kiểu dữ liệu thuần mà nó xuất
ra cho UI nằm riêng ở `explorer/src/types/sim.ts`. React chỉ là lớp hiển thị. Đừng
nhét logic chain vào component.

**Không có barrel/`index.ts`** ở bất kỳ đâu trong `core/src/` hay `explorer/src/`

- mọi import phải trỏ **đúng file** định nghĩa symbol đó (vd
  `import { Chain } from "@core/chain/chain"`, không phải qua 1 file gom export).
  Lý do: dễ lần theo phụ thuộc, tránh vỡ tree-shaking, và không quên "gắn cờ" module
  mới vào 1 file trung tâm rồi quên mất.

## 3. Các module trong `core/src/` (chia theo folder chức năng)

| Thư mục/File                 | Trách nhiệm                                                                                                                        | Ghi chú bất biến                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `constants/config.ts`        | Tham số có thể chỉnh (ký hiệu coin gốc `SAC`, thưởng block, halving interval, trần tổng cung, phí tx, gas mặc định).               | Đổi giá trị ở đây, không rải magic number.              |
| `types/types.ts`             | Toàn bộ kiểu dùng chung.                                                                                                           | Sửa kiểu ở đây, không định nghĩa rải rác.               |
| `crypto/crypto.ts`           | SHA-256, keccak, ví, địa chỉ, ký/khôi phục ECDSA (secp256k1).                                                                      | Địa chỉ = 20 byte cuối `keccak(pub[1:])`.               |
| `crypto/serialize.ts`        | Serialization **canonical** `[tag][len][payload]`, KHÔNG JSON.                                                                     | Mọi node phải ra cùng byte → cùng hash.                 |
| `fixed-point/fixed-point.ts` | Số BigInt fixed-point, 18 chữ số ("wei").                                                                                          | Không bao giờ dùng `number` cho tiền/state.             |
| `state/merkle.ts`            | Merkle root trên leaf đã sắp thứ tự.                                                                                               | Dùng cho `txRoot`, `stateRoot`.                         |
| `state/state.ts`             | `WorldState` (account model) + `stateRoot()` tất định.                                                                             | `clone()` để chạy thử không phá state gốc.              |
| `vm/vm.ts`                   | Máy ảo stack: BigInt, **đo gas**, revert atomic; `assemble()`.                                                                     | Tất định tuyệt đối (xem §4).                            |
| `vm/token.ts`                | Contract token mẫu viết bằng assembly của VM.                                                                                      | Ví dụ tham chiếu cách viết contract.                    |
| `transaction/transaction.ts` | Tx có chữ ký, hash canonical, `verifyTx`.                                                                                          | `nonce` chống replay; ký trên digest.                   |
| `transaction/processor.ts`   | Luật chuyển trạng thái transfer/deploy/call + `query` (read-only). Thu `TX_FEE` (burn) trên mọi tx.                                | Thứ tự: chữ ký → nonce → phí (burn) → số dư → thực thi. |
| `block/block.ts`             | Header, hash block, `txRoot`.                                                                                                      | Header cam kết `txRoot`+`stateRoot`+`prevHash`.         |
| `consensus/consensus.ts`     | BFT Tendermint-style + **telemetry** cho UI + `blockReward()` (cắt theo `MAX_SUPPLY`, burn 1 nửa pool chưa phân phối mỗi halving). | Ngưỡng `power*3 > total*2`.                             |
| `chain/chain.ts`             | `Chain`: giữ blocks + state, `commit(mempool, opts)`.                                                                              | Dùng chung bởi demo và explorer.                        |

Nhóm folder theo tầng phụ thuộc (mỗi thư mục có thể chứa >1 file liên quan chặt):
`types` (đáy, không phụ thuộc gì) → `crypto`/`fixed-point` → `state`/`vm` →
`transaction` → `block` → `consensus` → `chain` (đỉnh, dùng bởi demo/explorer).

## 4. Bất biến BẮT BUỘC giữ (đừng phá)

1. **Tất định (determinism).** Trong `core` cấm mọi nguồn bất định ảnh hưởng
   state: **không** `Date.now()`, `Math.random()`, thứ tự lặp phụ thuộc thứ tự
   chèn không kiểm soát, không float. Timestamp trong demo lấy từ `height`, không
   lấy giờ thực. Kiểm chứng: mọi node chạy lại cùng tx phải ra cùng `stateRoot`.
2. **Chỉ BigInt cho giá trị đồng thuận.** Không `number` cho số dư, gas, quyền
   biểu quyết. `number` chỉ được xuất hiện ở lớp UI khi vẽ (đã ép kiểu trong
   `explorer/src/simulator/chain-simulator.ts`).
3. **Isomorphic core.** `core/src/**` KHÔNG được dùng API riêng của Node
   (`Buffer`, `fs`, `process`, `crypto` của Node...). Dùng `@noble/hashes/utils`
   (`bytesToHex`, `hexToBytes`, `utf8ToBytes`) thay `Buffer`. Lý do: explorer chạy
   core trong trình duyệt. (`demo.ts` được phép dùng `console`/`structuredClone`
   vì chỉ chạy trên Node.)
4. **Canonical serialization.** Mọi thứ đưa vào hash phải qua `serialize.encode`,
   không `JSON.stringify` (thứ tự khoá/khoảng trắng không ổn định).
5. **Bảo mật không dựa vào giấu code.** Không thêm "bí mật" nào ngoài khoá riêng.
6. **Trần tổng cung SAC.** `blockReward()` (`consensus.ts`) không bao giờ mint vượt
   `MAX_SUPPLY` (`constants/config.ts`) - reward bị cắt theo pool còn lại, và pool đó tự
   burn 1 nửa phần chưa phân phối mỗi lần halving (`poolAtEpochStart()`). Đây là hàm
   THUẦN của height - không lưu counter riêng trong `WorldState`, mọi node tính lại y
   hệt nhau từ đúng 3 hằng số (`BLOCK_REWARD_BASE`, `HALVING_INTERVAL`, `MAX_SUPPLY`).
   Phí giao dịch (`TX_FEE`) cũng luôn bị **burn** (huỷ hẳn) ở `processor.ts`, không
   credit cho proposer hay ai khác.

## 5. Quy ước build & module

- **Import không đuôi** (`./crypto`, không `./crypto.js`). `tsconfig.base.json`
  đặt `moduleResolution: "Bundler"`, `module: "ESNext"`.
- **Không dùng barrel/`index.ts`.** Mọi import - kể cả nội bộ trong `core/src/`
  (module A dùng module B) lẫn từ `demo.ts`/`explorer` - phải trỏ thẳng file định
  nghĩa symbol, không qua 1 file gom re-export.
- **Explorer nạp core từ nguồn**, không từ `dist`: alias `@core` trong
  `vite.config.ts` và `paths` trong `explorer/tsconfig.json` đều trỏ `@core/*` →
  `../core/src/*` (thư mục, không phải 1 file). Import ví dụ:
  `import { Chain } from "@core/chain/chain"`,
  `import type { Hex } from "@core/types/types"`. Nhờ vậy `pnpm dev` không cần
  build core, và mỗi import luôn chỉ đúng file thật thay vì qua barrel.
- **Core build** (`pnpm --filter @simai-chain/core build`) = `esbuild` bundle
  `demo.ts` → `dist/demo.js` (một file ESM, `@noble/*` để external), dùng cho
  `pnpm --filter @simai-chain/core start:built`. Core không còn export ra ngoài
  như 1 package (`@simai-chain/core` trong `package.json` chỉ còn là tên
  workspace cho `pnpm --filter`, không phải specifier để `import`), nên không
  còn bundle `dist/index.js` hay xuất `.d.ts` nữa - không ai tiêu thụ chúng.
- Core chỉ còn 1 tsconfig: `tsconfig.json` (typecheck, gồm cả `demo.ts`,
  `noEmit`).
- **Format code bằng Prettier** (`.prettierrc.json` ở gốc repo: double quote,
  semicolon, trailing comma, printWidth 80). Chạy
  `pnpm exec prettier --write "**/*.{ts,tsx,css,md,json}" --ignore-path .gitignore`
  ở gốc sau khi sửa code — áp dụng cho cả `core` lẫn `explorer`, không có cấu hình
  Prettier riêng theo package.

## 6. Cách mở rộng thường gặp

**Thêm opcode VM:** khai báo trong `OpCode` (`core/src/types/types.ts`) → thêm
`case` trong `run()` (`core/src/vm/vm.ts`), nhớ `use(gas)` phù hợp → nếu là lệnh
nhảy, xử lý trong `assemble()`. Giữ tất định.

**Thêm loại giao dịch:** mở rộng `TxType` + `Tx` (`core/src/types/types.ts`) →
thêm nhánh trong `applyTx()` (`core/src/transaction/processor.ts`) → cập nhật
`txDigest`/`makeTx` (`core/src/transaction/transaction.ts`) nếu có trường mới ký.

**Thêm tính năng explorer:** logic đặt trong `explorer/src/simulator/chain-simulator.ts`
(thêm action + trường vào `SimState` - khai báo kiểu ở
`explorer/src/types/sim.ts` - của `snapshot()`), phơi ra qua
`explorer/src/hooks/useChainSimulator.ts`, rồi thêm component render (import trực tiếp
từ file component cần dùng, không qua barrel). **Không** gọi trực tiếp API core
từ component. Nếu component mới chỉ export đúng 1 function, dùng
`export default function X(...)` và import `import X from "./X"` (không `{}`) -
xem quy ước ở `explorer/README.md`.

**Đổi số validator / quyền biểu quyết:** sửa `VALIDATOR_COUNT` trong
`explorer/src/constants/config.ts` (và/hoặc `core/demo.ts` nếu muốn đổi demo CLI).
Ngưỡng tự tính theo tổng `power`.

**Đổi tham số blockchain (ký hiệu coin gốc, thưởng block, halving, trần tổng cung, phí
giao dịch, gas mặc định):** sửa trong `core/src/constants/config.ts` — mọi nơi hiển
thị/dùng các giá trị này (`consensus.ts`, `vm.ts`, `processor.ts`, `transaction.ts`,
`demo.ts`, và các component explorer import qua `@core/constants/config`) phải import
từ đây, không hardcode lại tên/số ở nơi khác. Tương tự,
`explorer/src/constants/config.ts` giữ tham số tầng mô phỏng (vd `VALIDATOR_COUNT`) —
KHÔNG gồm hằng số chỉ để tạo nhịp UI (`PROPOSAL_DELAY_MS`, `AUTO_MINE_PAUSE_MS`), vì đó
không phải "cấu hình blockchain".

## 7. Kiểm thử / định nghĩa "xong"

Trước khi coi một thay đổi là xong, chạy ở gốc:

```bash
pnpm typecheck   # strict + noUncheckedIndexedAccess, phải sạch
pnpm demo        # tất cả dấu ✅ phải còn (xem bên dưới)
pnpm --filter @simai-chain/explorer build   # Vite phải build thành công
```

`pnpm demo` phải giữ các bất biến: `0.1 + 0.2 = 0.3`; pre-vote `3/4` khi có 1
node equivocate; "trùng nhau ✅ (tất định)"; replay `TỪ CHỐI ✅`; giả mạo
`KHÔNG HỢP LỆ ✅`; sửa block `verifyCommit = FALSE ✅`; `2/4` im lặng
`KHÔNG CHỐT ✅`; mint trái phép không đổi số dư.

Muốn test nhanh lớp logic của explorer (không cần trình duyệt), tạo file `.mts`
trong `explorer/`, `import { ChainSimulator } from './src/simulator/chain-simulator'`, gọi action +
`snapshot()`, rồi `pnpm exec tsx file.mts`. Đây là cách kiểm tra runtime hiệu quả
vì `ChainSimulator` không phụ thuộc React.

## 8. Bẫy hay gặp

- Thêm dùng `Buffer` vào `core/src` → hỏng trong trình duyệt (vi phạm §4.3).
- Dùng `number` cho số dư/gas → sai chính xác, phá xác định.
- `JSON.stringify` để hash → khác byte giữa các node.
- Đặt logic chain trong React component → khó test, dễ lệch tầng.
- Đổi `moduleResolution` sang `NodeNext` mà quên thêm đuôi `.js` → tsc báo lỗi.
- Tạo lại 1 file `index.ts` "cho tiện" gom export → đi ngược lại quy ước không
  barrel (§2, §5); import trực tiếp file định nghĩa symbol thay vì thêm barrel mới.
- Thêm module mới trong `core/src/` nhưng quên rằng không có barrel để "lộ" nó ra
  ngoài - phải tự thêm import đúng path (`@core/...` ở explorer, `./src/...` ở
  `demo.ts`) tại nơi cần dùng.
