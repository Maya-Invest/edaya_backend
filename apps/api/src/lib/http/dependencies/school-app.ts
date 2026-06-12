import { resolveApiRuntime } from "@/lib/runtime/resolve-api-runtime";
import type { DependencyModule } from ".";

export function createSchoolAppDependency(): DependencyModule {
  return {
    name: "schoolApp",
    async resolve(c) {
      const runtime = await resolveApiRuntime(c);
      c.set("schoolApp", await runtime.getSchoolApplication());
    },
  };
}
