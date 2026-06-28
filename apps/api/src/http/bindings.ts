import type { PinoLogger } from "hono-pino";

import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, AuthService } from "@/runtime/types";
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
