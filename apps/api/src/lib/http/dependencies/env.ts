import { parseRuntimeEnv } from "@/lib/runtime/env";
import type { RuntimeBindings } from "@edaya/adaptor-cloudflare";
import type { AppBindings } from "@/lib/http/types";
import type { DependencyModule } from "@edaya/adaptor-cloudflare";

export const envDependency: DependencyModule<AppBindings> = {
  name: "env",
  resolve(c) {
    c.env = parseRuntimeEnv(c.env as RuntimeBindings);
  },
};
