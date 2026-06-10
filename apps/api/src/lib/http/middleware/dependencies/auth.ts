import { getApiRuntime } from "@/lib/runtime/registry";
import type { DependencyModule } from "../dependencies";

export const authDependency: DependencyModule = {
  name: "auth",
  async resolve(c) {
    const runtime = await getApiRuntime(c.env);
    c.set("auth", runtime.getAuth());
  },
};
