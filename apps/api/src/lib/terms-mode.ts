import { z } from "zod";

/** Legacy names remain accepted during rolling configuration upgrades. */
export const termsModeSchema = z.enum(["off", "live", "preview", "enforced"]);

export function resolveTermsMode(mode: z.infer<typeof termsModeSchema> | undefined, nodeEnv: string) {
  return mode ?? (nodeEnv === "production" ? "live" : "off");
}
