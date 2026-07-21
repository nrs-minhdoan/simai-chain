# simai-chain (TypeScript) — Blockchain simulator

Blockchain thu nhỏ nhưng **chạy thật**, viết bằng **TypeScript** (strict) và quản lý
bằng **pnpm**. Minh hoạ đủ 4 yêu cầu — đồng thuận, bảo mật, smart contract, số
chính xác — với giả định **code công khai / có thể đảo ngược** mà vẫn an toàn.

## Yêu cầu

- **Node.js >= 18** (BigInt, ESM, `structuredClone`).
- **pnpm** (bật nhanh qua Corepack, có sẵn trong Node):
  ```bash
  corepack enable pnpm
  corepack prepare pnpm@9 --activate
  pnpm --version        # kỳ vọng 9.x
  ```

## Chạy demo

```bash
cd simai-chain
pnpm install       # cài @noble/curves, @noble/hashes, typescript, tsx, @types/node

pnpm dev           # chạy trực tiếp demo.ts bằng tsx (không cần build) — cách nhanh nhất
```

Các script khác (khai báo trong `package.json`):

```bash
pnpm typecheck     # tsc --noEmit — kiểm tra kiểu, không xuất file
pnpm build         # tsc -> biên dịch ra thư mục dist/ (kèm .d.ts + sourcemap)
pnpm start:built   # node dist/demo.js — chạy bản đã biên dịch
```

### Output mong đợi (các mốc ✅)

```
0. SỐ HỌC        BigInt fixed-point: 0.1 + 0.2 = 0.3   ✅
3. BLOCK 1       PRE-VOTE cho block hợp lệ: 3/4 ...     (node Byzantine bị loại)
                 verifyCommit = true
5. TẤT ĐỊNH      Tất cả trùng nhau? ✅ CÓ (tất định)
6a REPLAY        -> TỪ CHỐI ✅
6b GIẢ MẠO       verifyTx = KHÔNG HỢP LỆ ✅
6c SỬA BLOCK     verifyCommit(block bị sửa) = FALSE ✅
6d BYZANTINE     KHÔNG CHỐT ✅ (2/4 im lặng -> dừng an toàn)
6e MINT TRÁI PHÉP token.balanceOf(bob) vẫn = 250 ✅
```

> Địa chỉ ví và hash block **khác nhau mỗi lần chạy** (khoá sinh ngẫu nhiên).
> Điều cần đúng là các dấu ✅.

## Mô hình bảo mật — vì sao lộ code vẫn an toàn (Kerckhoffs)

An toàn KHÔNG nằm ở việc giấu thuật toán, mà ở thứ có thể công khai toàn bộ:

1. **Khoá riêng bí mật** — thiếu key thì không ký được tx/vote.
2. **Giả định mật mã** — SHA-256 kháng va chạm, secp256k1 khó phá.
3. **Ngưỡng > 2/3** — muốn tấn công phải chiếm > 1/3 quyền biểu quyết _và_ khoá
   của các validator đó; đọc code không giúp gì.

## Cấu trúc (`src/`)

| File             | Vai trò                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `types.ts`       | Toàn bộ kiểu dùng chung (Tx, Block, Vote, Account, OpCode...)            |
| `crypto.ts`      | Hash (SHA-256/keccak), khoá & địa chỉ Ethereum-style, ký/khôi phục ECDSA |
| `serialize.ts`   | Serialization **canonical** (không JSON) → mọi node ra byte y hệt        |
| `fixedpoint.ts`  | Số **BigInt fixed-point** (mô hình wei, 18 chữ số)                       |
| `merkle.ts`      | Merkle root cho txRoot & stateRoot                                       |
| `state.ts`       | Trạng thái account + state root tất định                                 |
| `vm.ts`          | Máy ảo **tất định**: stack BigInt, **đo gas**, revert atomic             |
| `token.ts`       | Contract token mẫu bằng assembly của VM                                  |
| `transaction.ts` | Tx có chữ ký, hash canonical, chống replay bằng nonce                    |
| `processor.ts`   | Luật chuyển trạng thái (chữ ký → nonce → số dư → thực thi)               |
| `block.ts`       | Block header + hash, txRoot                                              |
| `consensus.ts`   | **BFT kiểu Tendermint**: propose → pre-vote → pre-commit → commit        |
| `demo.ts`        | Kịch bản chạy đầy đủ + các bài tấn công                                  |

## Ghi chú TypeScript

- `tsconfig.json` bật `strict` **và** `noUncheckedIndexedAccess` (an toàn chỉ mục mảng).
- Module dùng **NodeNext** nên import nội bộ có đuôi `.js` (trỏ tới output biên dịch)
  — đây là quy ước ESM chuẩn, `tsx` và `tsc` đều hiểu.
- `pnpm build` xuất kèm `.d.ts` để tái sử dụng như thư viện.

## Từ simulator lên production

Đây là mô phỏng **một tiến trình** để học/nghiên cứu. Chạy thật cần:

- **VM**: thay bằng EVM đã audit (`@ethereumjs/evm`) hoặc runtime WASM có sandbox.
- **Mạng P2P**: `js-libp2p` + gossip, timeout/round thật, xử lý phân mảnh mạng.
- **State**: Merkle-Patricia Trie + lưu trữ `level` (LevelDB).
- **Consensus đầy đủ**: luật lock/unlock, evidence + slashing double-sign.
- Cân nhắc Go/Rust cho lõi vì hiệu năng & constant-time crypto.
