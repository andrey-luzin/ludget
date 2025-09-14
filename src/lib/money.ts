export function sanitizeMoneyInput(raw: string): string {
  const replaced = raw.replace(/,/g, ".");
  // keep digits, optional leading -, and single dot
  let out = "";
  let dotSeen = false;
  for (let i = 0; i < replaced.length; i++) {
    const ch = replaced[i];
    if (i === 0 && ch === "-") {
      out += ch;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !dotSeen) {
      dotSeen = true;
      out += ch;
    }
  }
  return out;
}

export function roundMoneyAmount(n: number): number {
  return Math.floor(n * 100) / 100;
}

