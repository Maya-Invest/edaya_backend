import { parseRuntimeEnv } from "@/lib/runtime/env";
import type { DependencyModule } from "@/lib/http/dependency-injection";
import type { AppBindings } from "@/lib/http/types";
import type { RuntimeBindings } from "@/lib/runtime/host-types";

export const envDependency: DependencyModule<AppBindings> = {
  name: "env",
  resolve(c) {
    c.env = parseRuntimeEnv(c.env as RuntimeBindings);
  },
};
