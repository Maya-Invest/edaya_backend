import { resolveApiRuntime } from "@/lib/runtime/resolve-api-runtime";
import type { AppBindings } from "@/lib/http/types";
import type { DependencyModule } from "@/lib/http/dependency-injection";

export const authDependency: DependencyModule<AppBindings> = {
  name: "auth",
  async resolve(c) {
    const runtime = await resolveApiRuntime(c);
    c.set("auth", runtime.getAuth());
  },
};
