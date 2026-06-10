/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { type Environment, EnvSchema } from "@/lib/school-api/schemas/openapi/env.schemas";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

expand(config({
  path: path.resolve(
    apiRoot,
    process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  ),
}));

export type { Environment };

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors.join(",")}`).join(" | ")}`;
    throw new Error(errorMessage);
  }

  return env;
}
