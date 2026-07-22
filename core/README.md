# @simai-chain/core

Lõi blockchain - thư viện TypeScript **isomorphic** (chạy được cả Node lẫn trình
duyệt, không phụ thuộc API riêng của Node). Minh hoạ đủ 4 điều: đồng thuận BFT,
smart contract tất định, số học BigInt chính xác tuyệt đối, và bảo mật kiểu
Kerckhoffs (mã nguồn công khai vẫn an toàn). Được `demo.ts` (CLI) và
`../explorer` (React) dùng chung.

## Cấu trúc

Không có barrel/`index.ts` - mọi nơi dùng core (nội bộ giữa các file trong
`src/`, `demo.ts`, hay `explorer`) đều import **thẳng file** định nghĩa symbol
cần dùng, chia theo folder chức năng (tầng phụ thuộc thấp → cao):

```
core/
├─ package.json
├─ tsconfig.json    # typecheck (noEmit), gồm cả demo.ts
├─ build.mjs         # esbuild: bundle demo.ts -> dist/demo.js (cho start:built)
├─ demo.ts           # kịch bản CLI, import trực tiếp từng file trong ./src/**
└─ src/
   ├─ constants/config.ts      # NATIVE_SYMBOL (SAC), BLOCK_REWARD_BASE, HALVING_INTERVAL, MAX_SUPPLY, TX_FEE, DEFAULT_GAS_LIMIT
   ├─ types/types.ts           # Tx, Block, Vote, Account, OpCode, RoundTelemetry...
   ├─ crypto/
   │  ├─ crypto.ts             # SHA-256, keccak, ví, ECDSA
   │  └─ serialize.ts          # serialization canonical
   ├─ fixed-point/fixed-point.ts # số BigInt fixed-point
   ├─ state/
   │  ├─ merkle.ts             # merkle root
   │  └─ state.ts              # WorldState (account model)
   ├─ vm/
   │  ├─ vm.ts                 # máy ảo stack
   │  └─ token.ts              # contract token mẫu (dùng vm.ts)
   ├─ transaction/
   │  ├─ transaction.ts        # Tx có chữ ký, verifyTx
   │  └─ processor.ts          # applyTx, query, predictContractAddress
   ├─ block/block.ts           # header, hash block, txRoot
   ├─ consensus/consensus.ts   # BFT Tendermint-style + blockReward()
   └─ chain/chain.ts           # Chain: blocks + state + commit()
```

| Thư mục/File                 | Vai trò                                                                                                                                                                                                                                                                                                                                                                                  | Bất biến cần giữ                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants/config.ts`        | Tham số có thể chỉnh: `NATIVE_SYMBOL` (`"SAC"`), `BLOCK_REWARD_BASE` (100), `HALVING_INTERVAL` (100 000 block), `MAX_SUPPLY` (100 triệu SAC), `TX_FEE` (0.1 SAC/tx, burn), `DEFAULT_GAS_LIMIT`.                                                                                                                                                                                          | Mọi nơi hiển thị/dùng các giá trị này phải import từ đây, không hardcode lại tên/số ở nơi khác.                                                                                                                                                                                                   |
| `types/types.ts`             | Toàn bộ kiểu dùng chung (`Tx`, `Block`, `Vote`, `Account`, `OpCode`, `RoundTelemetry`...).                                                                                                                                                                                                                                                                                               | Sửa kiểu ở đây, không định nghĩa rải rác.                                                                                                                                                                                                                                                         |
| `crypto/crypto.ts`           | SHA-256, keccak, ví, địa chỉ, ký/khôi phục ECDSA (secp256k1).                                                                                                                                                                                                                                                                                                                            | Địa chỉ = 20 byte cuối `keccak(pub[1:])`. Chỉ dùng `@noble/hashes/utils`, không `Buffer`.                                                                                                                                                                                                         |
| `crypto/serialize.ts`        | Serialization **canonical** `[tag][len][payload]`, KHÔNG JSON.                                                                                                                                                                                                                                                                                                                           | Mọi node phải ra cùng byte → cùng hash.                                                                                                                                                                                                                                                           |
| `fixed-point/fixed-point.ts` | Số BigInt fixed-point, 18 chữ số ("wei").                                                                                                                                                                                                                                                                                                                                                | Không bao giờ dùng `number` cho tiền/state.                                                                                                                                                                                                                                                       |
| `state/merkle.ts`            | Merkle root trên leaf đã sắp thứ tự.                                                                                                                                                                                                                                                                                                                                                     | Dùng cho `txRoot`, `stateRoot`.                                                                                                                                                                                                                                                                   |
| `state/state.ts`             | `WorldState` (account model) + `stateRoot()` tất định.                                                                                                                                                                                                                                                                                                                                   | `clone()` để chạy thử không phá state gốc.                                                                                                                                                                                                                                                        |
| `vm/vm.ts`                   | Máy ảo stack: BigInt, **đo gas**, revert atomic; `assemble()`. Opcode `ISCONSTRUCTOR` chỉ true khi `processor.ts` tự gọi lúc deploy.                                                                                                                                                                                                                                                     | Tất định tuyệt đối - không `Date.now`/`Math.random`.                                                                                                                                                                                                                                              |
| `vm/token.ts`                | Contract token mẫu viết bằng assembly của VM. Owner gán 1 lần trong nhánh `ISCONSTRUCTOR` lúc deploy.                                                                                                                                                                                                                                                                                    | Ví dụ tham chiếu cách viết contract mới - **không** dùng kiểu "ai gọi trước thành owner" (lỗ hổng front-run kiểu Parity 2017).                                                                                                                                                                    |
| `transaction/transaction.ts` | Tx có chữ ký, hash canonical, `verifyTx`.                                                                                                                                                                                                                                                                                                                                                | `nonce` chống replay; ký trên digest.                                                                                                                                                                                                                                                             |
| `transaction/processor.ts`   | Luật chuyển trạng thái transfer/deploy/call + `query` (read-only) + `predictContractAddress`. Thu `TX_FEE` (burn, không credit cho ai) trên MỌI tx.                                                                                                                                                                                                                                      | Thứ tự: chữ ký → nonce → phí (burn) → số dư → thực thi. Phí bị trừ dù tx sau đó revert (chỉ tx bị từ chối hẳn mới không mất phí).                                                                                                                                                                 |
| `block/block.ts`             | Header, hash block, `txRoot`.                                                                                                                                                                                                                                                                                                                                                            | Header cam kết `txRoot`+`stateRoot`+`prevHash`.                                                                                                                                                                                                                                                   |
| `consensus/consensus.ts`     | BFT Tendermint-style (`runRound`, `verifyCommit`) + telemetry cho UI + `blockReward()` (thưởng coin gốc SAC cho proposer, giảm nửa mỗi `HALVING_INTERVAL` block - coinbase kiểu BTC/ETH, cách duy nhất tạo thêm SAC sau genesis). Mỗi lần halving, `poolAtEpochStart()` cũng BURN 1 nửa phần SAC còn CHƯA phân phối trong `MAX_SUPPLY` (huỷ vĩnh viễn, khác với việc giảm reward/block). | Ngưỡng `power*3 > total*2`. `proposeBlock()` và `validateBlock()` PHẢI cộng thưởng y hệt nhau trước khi tính `stateRoot`, nếu không validator trung thực sẽ tính lệch và coi nhầm block hợp lệ là gian lận. Tổng SAC mint qua `blockReward()` trong suốt lịch sử KHÔNG BAO GIỜ vượt `MAX_SUPPLY`. |
| `chain/chain.ts`             | `Chain`: giữ blocks + state, `commit(mempool, opts)`.                                                                                                                                                                                                                                                                                                                                    | Dùng chung bởi demo và explorer.                                                                                                                                                                                                                                                                  |
| `demo.ts`                    | Kịch bản CLI đầy đủ + các bài tấn công.                                                                                                                                                                                                                                                                                                                                                  | Chỉ file này (ngoài `src/`) được phép dùng `console`/`structuredClone`.                                                                                                                                                                                                                           |

## Chạy

```bash
pnpm install                # ở gốc repo
pnpm --filter @simai-chain/core demo         # chạy demo.ts bằng tsx, không cần build
pnpm --filter @simai-chain/core typecheck    # tsc --noEmit
pnpm --filter @simai-chain/core build        # esbuild bundle -> dist/demo.js
node core/dist/demo.js                     # chạy bản đã build
```

Từ gốc repo, các lệnh trên cũng có alias ngắn: `pnpm demo`, `pnpm typecheck`, `pnpm build`.

### Output mong đợi của `pnpm demo` (các mốc ✅)

```
0. SỐ HỌC        BigInt fixed-point: 0.1 + 0.2 = 0.3   ✅
3. BLOCK 1       PRE-VOTE cho block hợp lệ: 3/4 ...     (node Byzantine bị loại)
5. TẤT ĐỊNH      Tất cả trùng nhau? ✅ CÓ (tất định)
6a REPLAY        -> TỪ CHỐI ✅
6b GIẢ MẠO       verifyTx = KHÔNG HỢP LỆ ✅
6c SỬA BLOCK     verifyCommit(block bị sửa) = FALSE ✅
6d BYZANTINE     KHÔNG CHỐT ✅ (2/4 im lặng -> dừng an toàn)
6e MINT TRÁI PHÉP token.balanceOf(bob) vẫn = 250 ✅
```

> Địa chỉ ví và hash block **khác nhau mỗi lần chạy** (khoá sinh ngẫu nhiên).
> Điều cần đúng là các dấu ✅.

## Mô hình bảo mật (Kerckhoffs)

An toàn KHÔNG nằm ở việc giấu thuật toán - toàn bộ mã có thể công khai. An toàn
nằm ở:

1. **Khoá riêng bí mật** - thiếu key thì không ký được tx/vote.
2. **Giả định mật mã** - SHA-256 kháng va chạm, secp256k1 khó phá.
3. **Ngưỡng > 2/3** - muốn tấn công phải chiếm > 1/3 quyền biểu quyết _và_ khoá
   của các validator đó; đọc code không giúp gì.

## Ghi chú TypeScript

- `tsconfig.json` extend `../tsconfig.base.json`: `strict` + `noUncheckedIndexedAccess`,
  `moduleResolution: Bundler` → import nội bộ **không đuôi** (`./crypto`, không
  `./crypto.js`).
- Vì `Bundler` resolution không được Node ESM tự hiểu, `pnpm build` không dùng
  `tsc` để emit JS - nó chạy `build.mjs` (esbuild) để bundle `demo.ts` thành 1
  file độc lập chạy thẳng bằng `node` (`dist/demo.js`, cho `start:built`).
- Core **không export ra ngoài như 1 package** - không có barrel `index.ts`, và
  `@simai-chain/core` trong `package.json` chỉ là tên workspace cho
  `pnpm --filter`, không phải specifier để `import`. Explorer nạp thẳng từng
  file trong `src/**` qua alias `@core` (xem `../explorer/vite.config.ts`), nên
  sửa core là explorer nóng lại ngay, không cần chạy `build`.

## Từ simulator lên production

Đây là mô phỏng **một tiến trình** để học/nghiên cứu. Chạy thật cần:

- **VM**: thay bằng EVM đã audit (`@ethereumjs/evm`) hoặc runtime WASM có sandbox.
- **Mạng P2P**: `js-libp2p` + gossip, timeout/round thật, xử lý phân mảnh mạng.
- **State**: Merkle-Patricia Trie + lưu trữ `level` (LevelDB).
- **Consensus đầy đủ**: luật lock/unlock, evidence + slashing khi double-sign.
- Cân nhắc Go/Rust cho lõi vì hiệu năng & crypto constant-time.
