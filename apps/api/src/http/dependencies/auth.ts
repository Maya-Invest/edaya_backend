import { resolveApiRuntime } from "@/runtime/resolve-api-runtime";
import { resolveWorkerAuthService } from "@/runtime/worker/auth-service";
import type { AppBindings } from "@/http/types";
import type { DependencyModule } from "@/http/dependency-injection";
import { isBetterAuthPath } from "./utils";

export const authDependency: DependencyModule<AppBindings> = {
  name: "auth",
  async resolve(c) {
    if (isBetterAuthPath(c) && c.env.RUNTIME === "worker") {
      c.set("auth", await resolveWorkerAuthService(c.env));
      return;
    }

    const runtime = await resolveApiRuntime(c);
    c.set("auth", runtime.getAuth());
  },
};
