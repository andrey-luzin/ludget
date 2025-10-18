// Allow digits, decimal separator, basic math operators, parentheses, whitespace
const INPUT_ALLOWED_CHARS = /[^0-9+\-*/().\s]/g;

export function sanitizeMoneyInput(raw: string): string {
  return raw.replace(/,/g, ".").replace(INPUT_ALLOWED_CHARS, "");
}

export function evaluateAmountExpression(raw: string): number | null {
  const cleaned = sanitizeMoneyInput(raw).trim();
  if (!cleaned) {
    return null;
  }
  try {
    const fn = new Function(`"use strict"; return (${cleaned});`);
    const result = fn();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch (error) {
    console.warn("Failed to evaluate amount expression", { raw, error });
    return null;
  }
}

export function roundMoneyAmount(n: number): number {
  return Math.floor(n * 100) / 100;
}

export function getAmountPreview(raw: string): string | null {
  const sanitized = sanitizeMoneyInput(raw).trim();
  if (!sanitized) {
    return null;
  }
  const expressionBody = sanitized.startsWith("-") ? sanitized.slice(1) : sanitized;
  if (!/[+\-*/]/.test(expressionBody)) {
    return null;
  }
  const evaluated = evaluateAmountExpression(sanitized);
  if (evaluated == null) {
    return null;
  }
  const rounded = roundMoneyAmount(evaluated).toFixed(2);
  return `=${rounded}`;
}

// Format money amounts with thin spaces as thousand separators.
// Examples: 12333 => "12 333", 12333.83 => "12 333.83"
export function formatMoneyAmount(amount: number): string {
  const rounded = roundMoneyAmount(Number(amount));
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  // Keep up to 2 decimals but trim trailing zeros
  const fixed = abs.toFixed(2);
  const [intPartRaw, fracRaw] = fixed.split(".");
  const intPart = intPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  const frac = fracRaw.replace(/0+$/, "");
  return sign + intPart + (frac ? "." + frac : "");
}
