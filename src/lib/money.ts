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
