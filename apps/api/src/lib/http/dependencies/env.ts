import { parseRuntimeEnv } from "@/lib/runtime/env";
import type { DependencyModule } from ".";

export const envDependency: DependencyModule = {
  name: "env",
  resolve(c) {
    c.env = parseRuntimeEnv(c.env);
  },
};
