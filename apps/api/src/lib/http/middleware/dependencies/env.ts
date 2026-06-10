import { parseRuntimeEnv } from "@/lib/runtime/env";
import type { DependencyModule } from "../dependencies";

export const envDependency: DependencyModule = {
  name: "env",
  resolve(c) {
    c.env = parseRuntimeEnv(c.env);
  },
};
