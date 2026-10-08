import { z } from "zod";

/** Identical boolean handling for early Worker controls and runtime settings. */
export const envBooleanSchema = z.preprocess((value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (normalized === "true" || normalized === "1" || normalized === 1)
    return true;
  if (normalized === "false" || normalized === "0" || normalized === 0)
    return false;
  return normalized;
}, z.boolean());
