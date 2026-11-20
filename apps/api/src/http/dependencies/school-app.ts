import { resolveApiRuntime } from "@/runtime/resolve-api-runtime";
import type { AppBindings } from "@/http/types";
import type { DependencyModule } from "@/http/dependency-injection";

export const schoolAppDependency: DependencyModule<AppBindings> = {
  name: "schoolApp",
  async resolve(c) {
    const runtime = await resolveApiRuntime(c);
    c.set("schoolApp", await runtime.getSchoolApplication());
  },
};
