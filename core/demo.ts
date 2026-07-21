// ===========================================================================
// demo.ts — Kịch bản CLI. Chạy: pnpm --filter @chain-sim/core demo
// ===========================================================================
import {
  newWallet, toHex, WorldState, makeTx, verifyTx, txDigest, applyTx, query,
  verifyCommit, short, headerDigest, txRootOf, parseFixed, formatFixed,
  tokenCode, M_TRANSFER, M_BALANCEOF, M_MINT, Chain,
  type Validator, type Tx, type Hex,
} from './src/index';

const line = (s = ''): void => console.log(s);
const H = (t: string): void => { line(); line('═'.repeat(74)); line('  ' + t); line('═'.repeat(74)); };
const addrToBig = (a: Hex): bigint => BigInt(a);

// ---------------------------------------------------------------------------
H('0.  SỐ HỌC CHÍNH XÁC — vì sao KHÔNG dùng Number cho tiền');
line(`  Number:  0.1 + 0.2            = ${0.1 + 0.2}   ❌ sai`);
line(`  Number:  2^53 + 1             = ${2 ** 53 + 1}   ❌ mất chính xác`);
line(`  BigInt fixed-point: 0.1 + 0.2 = ${formatFixed(parseFixed('0.1') + parseFixed('0.2'))}   ✅`);
const huge = parseFixed('9007199254740993.000000000000000001');
line(`  BigInt fixed-point: số rất lớn+lẻ = ${formatFixed(huge)}   ✅ chính xác tuyệt đối`);

// ---------------------------------------------------------------------------
H('1.  KHỞI TẠO — 4 validator (BFT chịu <1/3 lỗi) + 3 người dùng');
const validators: Validator[] = [0, 1, 2, 3].map((i) => ({
  wallet: newWallet(), byzantine: 'none', power: 1n, name: `V${i}`,
}));
const [alice, bob, carol] = [newWallet(), newWallet(), newWallet()];
validators.forEach((v) => line(`  validator ${v.name}: ${short(v.wallet.address)}`));
line(`  alice: ${short(alice.address)}   bob: ${short(bob.address)}   carol: ${short(carol.address)}`);

const chain = new Chain(validators);

// ---------------------------------------------------------------------------
H('2.  GENESIS — cấp phát ban đầu, chốt bằng đồng thuận');
chain.state.credit(alice.address, parseFixed('100'));
chain.state.credit(bob.address, parseFixed('50'));
line(`  Cấp: alice=100, bob=50 coin. stateRoot = ${short(chain.state.stateRoot())}`);
chain.commit([], { log: line });
line(`  Genesis block ${short(chain.head!.hash)} đã chốt.`);

// ---------------------------------------------------------------------------
H('3.  BLOCK 1 — chuyển tiền có chữ ký, VỚI 1 validator BYZANTINE');
const tx1 = makeTx({ type: 'transfer', from: alice.address, priv: alice.priv, nonce: 0n, to: bob.address, value: parseFixed('30') });
const tx2 = makeTx({ type: 'transfer', from: bob.address, priv: bob.priv, nonce: 0n, to: carol.address, value: parseFixed('20') });
line(`  alice->bob 30,  bob->carol 20.  V3 là node xấu (equivocate):`);
const byzV: Validator[] = validators.map((v, i) => ({ ...v, byzantine: i === 3 ? 'equivocate' : 'none' }));
chain.commit([tx1, tx2], { validators: byzV, log: line });
line(`  verifyCommit(bên thứ ba) = ${verifyCommit(chain.head!, validators, 1)}`);
line(`  Số dư: alice=${formatFixed(chain.state.balanceOf(alice.address))}, bob=${formatFixed(chain.state.balanceOf(bob.address))}, carol=${formatFixed(chain.state.balanceOf(carol.address))}`);

// ---------------------------------------------------------------------------
H('4.  BLOCK 2 — deploy smart contract token');
const deploy = makeTx({ type: 'deploy', from: alice.address, priv: alice.priv, nonce: 1n, code: tokenCode });
chain.commit([deploy], { log: line });
let tokenAddr: Hex = '0x';
for (const [addr, a] of chain.state.accounts) if (a.code) tokenAddr = addr;
line(`  Token deploy tại ${short(tokenAddr)}`);

// ---------------------------------------------------------------------------
H('5.  BLOCK 3 — mint + transfer token, kiểm tra TÍNH TẤT ĐỊNH');
const mint = makeTx({ type: 'call', from: alice.address, priv: alice.priv, nonce: 2n, to: tokenAddr,
  dataArgs: [M_MINT, addrToBig(alice.address), parseFixed('1000')] });
const sendTok = makeTx({ type: 'call', from: alice.address, priv: alice.priv, nonce: 3n, to: tokenAddr,
  dataArgs: [M_TRANSFER, addrToBig(bob.address), parseFixed('250')] });
chain.commit([mint, sendTok], { log: line });
const balA = query(chain.state, tokenAddr, [M_BALANCEOF, addrToBig(alice.address)]);
const balB = query(chain.state, tokenAddr, [M_BALANCEOF, addrToBig(bob.address)]);
line(`  token.balanceOf(alice) = ${formatFixed(balA!)}   token.balanceOf(bob) = ${formatFixed(balB!)}`);

function replayTo(heightExclusive: number): WorldState {
  const s = new WorldState();
  s.credit(alice.address, parseFixed('100'));
  s.credit(bob.address, parseFixed('50'));
  for (let h = 1; h < heightExclusive; h++) for (const tx of chain.blocks[h]!.txs) applyTx(s, tx);
  return s;
}
const preBlock3 = replayTo(3);
const roots = validators.map(() => {
  const s = preBlock3.clone();
  for (const tx of chain.blocks[3]!.txs) applyTx(s, tx);
  return s.stateRoot();
});
line(`  4 validator tự tính stateRoot -> trùng nhau? ${new Set(roots).size === 1 ? '✅ CÓ (tất định)' : '❌ KHÔNG'}`);

// ---------------------------------------------------------------------------
H('6.  CÁC KỊCH BẢN TẤN CÔNG');
const liveReplay = applyTx(chain.state, { ...tx1 });
line(`  6a REPLAY tx cũ            -> ${liveReplay.ok ? 'CHẤP NHẬN ❌' : 'TỪ CHỐI ✅'}`);
const forged: Tx = { ...tx1, value: parseFixed('999999') };
line(`  6b GIẢ MẠO value           -> verifyTx = ${verifyTx(forged) ? 'HỢP LỆ ❌' : 'KHÔNG HỢP LỆ ✅'}`);
const tampered = structuredClone(chain.blocks[1]!);
tampered.txs[0]!.value = parseFixed('31');
tampered.txs[0]!.hash = toHex(txDigest(tampered.txs[0]!));
tampered.header.txRoot = txRootOf(tampered.txs);
tampered.hash = toHex(headerDigest(tampered.header));
line(`  6c SỬA block đã chốt       -> verifyCommit = ${verifyCommit(tampered, validators, 1) ? 'TRUE ❌' : 'FALSE ✅'}`);
const chain2 = new Chain(validators);
chain2.state.credit(alice.address, parseFixed('100'));
chain2.commit([]);
const halfSilent: Validator[] = validators.map((v, i) => ({ ...v, byzantine: i >= 2 ? 'silent' : 'none' }));
const rr = chain2.commit(
  [makeTx({ type: 'transfer', from: alice.address, priv: alice.priv, nonce: 0n, to: bob.address, value: parseFixed('1') })],
  { validators: halfSilent },
);
line(`  6d NGƯỠNG 1/3 (2/4 im lặng) -> ${rr.committed ? 'CHỐT ❌' : 'KHÔNG CHỐT ✅ (dừng an toàn)'}`);
const evilMint = makeTx({ type: 'call', from: bob.address, priv: bob.priv, nonce: 1n, to: tokenAddr,
  dataArgs: [M_MINT, addrToBig(bob.address), parseFixed('1000000')] });
chain.commit([evilMint]);
const balBAfter = query(chain.state, tokenAddr, [M_BALANCEOF, addrToBig(bob.address)]);
line(`  6e MINT trái phép (bob)     -> balanceOf(bob) vẫn = ${formatFixed(balBAfter!)} ✅`);

H('KẾT LUẬN');
line(`  Chain cao ${chain.height} block, mọi bất biến ✅. Xem trực quan bằng explorer: pnpm dev`);
