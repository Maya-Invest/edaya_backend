import { resolveApiRuntime } from "@/runtime/resolve-api-runtime";
import type { AppBindings } from "@/http/types";
import type { DependencyModule } from "@/http/dependency-injection";

export const authDependency: DependencyModule<AppBindings> = {
  name: "auth",
  async resolve(c) {
    const runtime = await resolveApiRuntime(c);
    c.set("auth", runtime.getAuth());
  },
};
