import { parseRuntimeEnv } from "@/runtime/env";
import type { RuntimeBindings } from "@/runtime/types";
import type { DependencyModule } from "@/http/dependency-injection";
import type { AppBindings } from "@/http/types";

export const envDependency: DependencyModule<AppBindings> = {
  name: "env",
  resolve(c) {
    c.env = parseRuntimeEnv(c.env as RuntimeBindings);
  },
};
