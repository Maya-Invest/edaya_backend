import { resolveApiRuntime } from "@/runtime/resolve-api-runtime";
import type { AppBindings } from "@/http/types";
import type { DependencyModule } from "@/http/dependency-injection";

export const identityClientDependency: DependencyModule<AppBindings> = {
  name: "identityClient",
  async resolve(c) {
    const runtime = await resolveApiRuntime(c);
    c.set("identityClient", runtime.getIdentityClient());
  },
};
