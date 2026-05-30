export function normalizeTaggedNumber(input: string | number): string {
  if (typeof input === "number") {
    if (!Number.isInteger(input) || input < 0) {
      throw new Error("Number must be a non-negative integer.");
    }
    return `#${input}#`;
  }

  if (typeof input === "string") {
    const match = input.match(/^#(\d+)#$/);
    if (match) {
      return input;
    }
    const parsed = Number.parseInt(input, 10);
    if (!Number.isNaN(parsed) && String(parsed) === input) {
      return `#${parsed}#`;
    }
  }

  throw new Error("Input must be a string or number in the format '#<number>#' or a valid integer.");
}

export function parseIdRangeList(input: string): string[] {
  const ids = new Set<number>();

  const parts = input.split(",");
  for (const part of parts) {
    const trimmed = part.trim();

    // Match range like "3-7"
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);
      if (start > end)
        throw new Error(`Invalid range: ${trimmed}`);
      for (let i = start; i <= end; i++) {
        ids.add(i);
      }
      continue;
    }

    // Match single number like "8"
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < 0) {
      throw new Error(`Invalid ID value: "${trimmed}"`);
    }
    ids.add(num);
  }

  return Array.from(ids).sort((a, b) => a - b).map(normalizeTaggedNumber);
}
