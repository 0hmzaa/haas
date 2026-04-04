const TINYBARS_PER_HBAR = 100_000_000n;

function normalizeHbar(value: string): string {
  return value.trim();
}

export function isHederaAccountId(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function hbarToTinybars(value: string): bigint {
  const normalized = normalizeHbar(value);

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid HBAR amount format");
  }

  const [wholeRaw, fractionRaw = ""] = normalized.split(".");
  const whole = BigInt(wholeRaw);

  if (fractionRaw.length > 8) {
    throw new Error("HBAR amount supports up to 8 decimal places");
  }

  const paddedFraction = (fractionRaw + "00000000").slice(0, 8);
  const fraction = BigInt(paddedFraction);

  return whole * TINYBARS_PER_HBAR + fraction;
}

export function tinybarsToHbar(tinybars: bigint): string {
  if (tinybars < 0n) {
    throw new Error("tinybars cannot be negative");
  }

  const whole = tinybars / TINYBARS_PER_HBAR;
  const fraction = tinybars % TINYBARS_PER_HBAR;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionPadded = fraction.toString().padStart(8, "0");
  const fractionTrimmed = fractionPadded.replace(/0+$/, "");

  return `${whole.toString()}.${fractionTrimmed}`;
}
