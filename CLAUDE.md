# CLAUDE.md

Hướng dẫn cho AI (và người) bảo trì, phát triển repo này. Đọc trước khi sửa code.

## 1. Dự án là gì

`chain-sim` là blockchain mô phỏng **chạy thật** + explorer React. Mục tiêu là
minh hoạ **chính xác và trung thực** 4 điều: đồng thuận BFT, smart contract tất
định, số học chính xác, và bảo mật kiểu Kerckhoffs (công khai code vẫn an toàn).
Ưu tiên **sự đúng đắn và rõ ràng** hơn hiệu năng. Đây là công cụ học tập/nghiên
cứu, KHÔNG phải blockchain production — đừng thêm tính năng làm mờ các bất biến bên dưới.

## 2. Bố cục & luồng dữ liệu

```
@chain-sim/core (thư viện thuần, isomorphic)
        ▲                         ▲
        │ import qua Vite alias   │ import (tsx)
        │  → core/src/index.ts    │
explorer/src/sim.ts          core/demo.ts (CLI)
   (ChainSim: điều khiển)
        ▲
        │
explorer/src/useChainSim.ts (hook React: giữ ChainSim trong useRef, snapshot → useState)
        ▲
        │
explorer/src/App.tsx + components/ (chỉ render, không chứa logic chain)
```

**Nguyên tắc phân tầng:** mọi logic blockchain nằm ở `core`. Logic điều phối mô
phỏng (mempool, nhãn địa chỉ, dựng snapshot) nằm ở `explorer/src/sim.ts` —
**không phụ thuộc React** nên test được bằng `tsx`. React chỉ là lớp hiển thị.
Đừng nhét logic chain vào component.

## 3. Các module trong `packages/core/src`

| File | Trách nhiệm | Ghi chú bất biến |
|------|-------------|------------------|
| `types.ts` | Toàn bộ kiểu dùng chung. | Sửa kiểu ở đây, không định nghĩa rải rác. |
| `crypto.ts` | SHA-256, keccak, ví, địa chỉ, ký/khôi phục ECDSA (secp256k1). | Địa chỉ = 20 byte cuối `keccak(pub[1:])`. |
| `serialize.ts` | Serialization **canonical** `[tag][len][payload]`, KHÔNG JSON. | Mọi node phải ra cùng byte → cùng hash. |
| `fixedpoint.ts` | Số BigInt fixed-point, 18 chữ số ("wei"). | Không bao giờ dùng `number` cho tiền/state. |
| `merkle.ts` | Merkle root trên leaf đã sắp thứ tự. | Dùng cho `txRoot`, `stateRoot`. |
| `state.ts` | `WorldState` (account model) + `stateRoot()` tất định. | `clone()` để chạy thử không phá state gốc. |
| `vm.ts` | Máy ảo stack: BigInt, **đo gas**, revert atomic; `assemble()`. | Tất định tuyệt đối (xem §4). |
| `token.ts` | Contract token mẫu viết bằng assembly của VM. | Ví dụ tham chiếu cách viết contract. |
| `transaction.ts` | Tx có chữ ký, hash canonical, `verifyTx`. | `nonce` chống replay; ký trên digest. |
| `processor.ts` | Luật chuyển trạng thái transfer/deploy/call + `query` (read-only). | Thứ tự: chữ ký → nonce → số dư → thực thi. |
| `block.ts` | Header, hash block, `txRoot`. | Header cam kết `txRoot`+`stateRoot`+`prevHash`. |
| `consensus.ts` | BFT Tendermint-style + **telemetry** cho UI. | Ngưỡng `power*3 > total*2`. |
| `chain.ts` | `Chain`: giữ blocks + state, `commit(mempool, opts)`. | Dùng chung bởi demo và explorer. |
| `index.ts` | Barrel export công khai. | Thêm module mới thì export ở đây. |

## 4. Bất biến BẮT BUỘC giữ (đừng phá)

1. **Tất định (determinism).** Trong `core` cấm mọi nguồn bất định ảnh hưởng
   state: **không** `Date.now()`, `Math.random()`, thứ tự lặp phụ thuộc thứ tự
   chèn không kiểm soát, không float. Timestamp trong demo lấy từ `height`, không
   lấy giờ thực. Kiểm chứng: mọi node chạy lại cùng tx phải ra cùng `stateRoot`.
2. **Chỉ BigInt cho giá trị đồng thuận.** Không `number` cho số dư, gas, quyền
   biểu quyết. `number` chỉ được xuất hiện ở lớp UI khi vẽ (đã ép kiểu trong `sim.ts`).
3. **Isomorphic core.** `core/src/**` KHÔNG được dùng API riêng của Node
   (`Buffer`, `fs`, `process`, `crypto` của Node...). Dùng `@noble/hashes/utils`
   (`bytesToHex`, `hexToBytes`, `utf8ToBytes`) thay `Buffer`. Lý do: explorer chạy
   core trong trình duyệt. (`demo.ts` được phép dùng `console`/`structuredClone`
   vì chỉ chạy trên Node.)
4. **Canonical serialization.** Mọi thứ đưa vào hash phải qua `serialize.encode`,
   không `JSON.stringify` (thứ tự khoá/khoảng trắng không ổn định).
5. **Bảo mật không dựa vào giấu code.** Không thêm "bí mật" nào ngoài khoá riêng.

## 5. Quy ước build & module

- **Import không đuôi** (`./crypto`, không `./crypto.js`). `tsconfig.base.json`
  đặt `moduleResolution: "Bundler"`, `module: "ESNext"`.
- **Explorer nạp core từ nguồn**, không từ `dist`: alias trong `vite.config.ts`
  và `paths` trong `explorer/tsconfig.json` đều trỏ `@chain-sim/core` →
  `../core/src/index.ts`. Nhờ vậy `pnpm dev` không cần build core.
- **Core build** (`pnpm --filter @chain-sim/core build`) = `esbuild` bundle
  `src/index.ts` → `dist/index.js` (một file ESM, `@noble/*` để external) +
  `tsc --emitDeclarationOnly` xuất `.d.ts`. Bundle để `dist` chạy được bằng Node
  thuần (import không đuôi mà tsc phát ra thì Node ESM không tự resolve).
- Hai tsconfig ở core: `tsconfig.json` (typecheck, gồm cả `demo.ts`, `noEmit`);
  `tsconfig.build.json` (chỉ `src`, xuất declaration).

## 6. Cách mở rộng thường gặp

**Thêm opcode VM:** khai báo trong `OpCode` (`types.ts`) → thêm `case` trong
`run()` (`vm.ts`), nhớ `use(gas)` phù hợp → nếu là lệnh nhảy, xử lý trong
`assemble()`. Giữ tất định.

**Thêm loại giao dịch:** mở rộng `TxType` + `Tx` (`types.ts`) → thêm nhánh trong
`applyTx()` (`processor.ts`) → cập nhật `txDigest`/`makeTx` nếu có trường mới ký.

**Thêm tính năng explorer:** logic đặt trong `sim.ts` (thêm action + trường vào
`SimState` của `snapshot()`), phơi ra qua `useChainSim.ts`, rồi thêm component
render. **Không** gọi trực tiếp API core từ component.

**Đổi số validator / quyền biểu quyết:** sửa trong `ChainSim.reset()`
(`explorer/src/sim.ts`) và/hoặc `demo.ts`. Ngưỡng tự tính theo tổng `power`.

## 7. Kiểm thử / định nghĩa "xong"

Trước khi coi một thay đổi là xong, chạy ở gốc:

```bash
pnpm typecheck   # strict + noUncheckedIndexedAccess, phải sạch
pnpm demo        # tất cả dấu ✅ phải còn (xem bên dưới)
pnpm --filter @chain-sim/explorer build   # Vite phải build thành công
```

`pnpm demo` phải giữ các bất biến: `0.1 + 0.2 = 0.3`; pre-vote `3/4` khi có 1
node equivocate; "trùng nhau ✅ (tất định)"; replay `TỪ CHỐI ✅`; giả mạo
`KHÔNG HỢP LỆ ✅`; sửa block `verifyCommit = FALSE ✅`; `2/4` im lặng
`KHÔNG CHỐT ✅`; mint trái phép không đổi số dư.

Muốn test nhanh lớp logic của explorer (không cần trình duyệt), tạo file `.mts`
trong `packages/explorer`, `import { ChainSim } from './src/sim'`, gọi action +
`snapshot()`, rồi `pnpm exec tsx file.mts`. Đây là cách kiểm tra runtime hiệu quả
vì `sim.ts` không phụ thuộc React.

## 8. Bẫy hay gặp

- Thêm dùng `Buffer` vào `core/src` → hỏng trong trình duyệt (vi phạm §4.3).
- Dùng `number` cho số dư/gas → sai chính xác, phá xác định.
- `JSON.stringify` để hash → khác byte giữa các node.
- Đặt logic chain trong React component → khó test, dễ lệch tầng.
- Đổi `moduleResolution` sang `NodeNext` mà quên thêm đuôi `.js` → tsc báo lỗi.
- Quên export module mới trong `core/src/index.ts` → explorer không thấy.
