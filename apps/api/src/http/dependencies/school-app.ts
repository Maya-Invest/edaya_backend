import { resolveApiRuntime } from "@/runtime/resolve/api-runtime";
import type { AppBindings } from "@/http/types";
import type { DependencyModule } from "@/http/dependency-injection";
import { isBetterAuthPath } from "./utils";

export function createSchoolAppDependency(): DependencyModule<AppBindings> {
  return {
    name: "schoolApp",
    async resolve(c) {
      if (isBetterAuthPath(c)) {
        return;
      }

      const runtime = await resolveApiRuntime(c);
      c.set("schoolApp", await runtime.getSchoolApplication());
    },
  };
}
