// ---------------------------------------------------------------------------
// fixed-point.ts — Xử lý số CHÍNH XÁC. Mọi giá trị là integer BigInt đã nhân
// 10^18 (mô hình "wei"). Không float ở bất kỳ đường đi nào ảnh hưởng state.
// ---------------------------------------------------------------------------
export const DECIMALS = 18n;
export const ONE = 10n ** DECIMALS; // 1.0 = 10^18 đơn vị nhỏ nhất

/** Parse "12.5" -> BigInt fixed-point, không qua float. */
export function parseFixed(str: string): bigint {
  const neg = str.startsWith("-");
  const s = neg ? str.slice(1) : str;
  const [intPart, fracRaw = ""] = s.split(".");
  const frac = (fracRaw + "0".repeat(Number(DECIMALS))).slice(
    0,
    Number(DECIMALS),
  );
  const v = BigInt(intPart || "0") * ONE + BigInt(frac || "0");
  return neg ? -v : v;
}

/** Format BigInt fixed-point -> chuỗi thập phân, không qua float. */
export function formatFixed(v: bigint): string {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const int = a / ONE;
  const frac = (a % ONE)
    .toString()
    .padStart(Number(DECIMALS), "0")
    .replace(/0+$/, "");
  return (neg ? "-" : "") + int.toString() + (frac ? "." + frac : "");
}
