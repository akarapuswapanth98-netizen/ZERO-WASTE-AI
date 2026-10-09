/** Money with sign before the symbol: -$1.23, never $-1.23. */
export function fmtMoney(n: number, digits = 2): string {
  const abs = Math.abs(n).toFixed(digits);
  return `${n < 0 ? "-" : ""}$${abs}`;
}

/** Signed impact: savings show as +$20.52, costs as $34.26. */
export function fmtImpact(loss: number, digits = 2): string {
  if (loss < 0) return `+$${Math.abs(loss).toFixed(digits)}`;
  return `$${loss.toFixed(digits)}`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}
