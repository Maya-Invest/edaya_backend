import { resolveApiRuntime } from "@/lib/runtime/resolve-api-runtime";
import type { AppBindings } from "@/lib/http/types";
import type { DependencyModule } from "@edaya/adaptor-cloudflare";

export function createSchoolAppDependency(): DependencyModule<AppBindings> {
  return {
    name: "schoolApp",
    async resolve(c) {
      const runtime = await resolveApiRuntime(c);
      c.set("schoolApp", await runtime.getSchoolApplication());
    },
  };
}
