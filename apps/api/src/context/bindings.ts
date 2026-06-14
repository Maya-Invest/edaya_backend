import type { PinoLogger } from "hono-pino";

import type { Environment } from "@/runtime/env/schema";
import type { ApiRuntime, AuthService } from "@/runtime/types";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/core";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
    apiRuntime?: ApiRuntime;
    schoolApp: ApiSchoolApplication;
    auth: AuthService;
    actor: ActorMetadata | null;
  };
}
