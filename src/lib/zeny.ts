// Ported from the reference tool's utils.parseZeny
// (https://github.com/d44aki-lang/RO-tools). Accepts plain numbers, comma
// grouping, and k/M/G suffixes (case-insensitive): 10k -> 10000,
// 1.5M -> 1500000, 2G -> 2000000000. Display stays plain comma-separated
// numbers after saving, per the reference tool's own guide notes.
export function parseZeny(input: string): number {
  const s = input.replace(/,/g, "").trim().toLowerCase();
  if (!s) return 0;
  const m = s.match(/^([\d.]+)([kmg])?$/);
  if (!m) return Number(s) || 0;
  const factors: Record<string, number> = {
    k: 1000,
    m: 1_000_000,
    g: 1_000_000_000,
  };
  const unit = m[2];
  return Math.floor(parseFloat(m[1]) * (unit ? factors[unit] : 1));
}

/** Ported from the reference tool's utils.formatZeny — compact K/M/G display (1000+ -> K, 1000K+ -> M, 1000M+ -> G). */
export function formatZeny(num: number, sf = 4): string {
  if (!num) return "0";
  const abs = Math.abs(num);
  let unit = "";
  let factor = 1;
  if (abs >= 1e9) {
    unit = "G";
    factor = 1e9;
  } else if (abs >= 1e6) {
    unit = "M";
    factor = 1e6;
  } else if (abs >= 1e3) {
    unit = "K";
    factor = 1e3;
  }
  const val = parseFloat((num / factor).toPrecision(sf));
  return `${val}${unit}`;
}

/** formatZeny with the " z" suffix used across most of the app's money displays. */
export function formatZ(num: number): string {
  return `${formatZeny(num)} z`;
}

/** Ported from the reference tool: characters on the "N server" (Noatun) use a x1000 money rate, applied only to their base cash holdings. NFKC-normalizes first so a full-width "Ｎ鯖" (common with Japanese IME input) still matches the half-width pattern. */
export function isNServerCharacter(server: string): boolean {
  return /N|N鯖|Noatun/i.test(server.normalize("NFKC"));
}
