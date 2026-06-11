import { getApiRuntime } from "@/lib/runtime/registry";
import type { DependencyModule } from ".";

export function createSchoolAppDependency(): DependencyModule {
  return {
    name: "schoolApp",
    async resolve(c) {
      const runtime = await getApiRuntime(c.env);
      c.set("schoolApp", await runtime.getSchoolApplication());
    },
  };
}
