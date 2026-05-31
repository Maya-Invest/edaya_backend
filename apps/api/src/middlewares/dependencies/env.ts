import { parseEnv } from "@/env";
import type { DependencyModule } from "../dependencies-injection";

export const envDependency: DependencyModule = {
  name: "env",
  resolve(c) {
    // eslint-disable-next-line node/no-process-env
    const env = Object.assign(c.env || {}, process.env);
    c.env = parseEnv(env);
  },
};
