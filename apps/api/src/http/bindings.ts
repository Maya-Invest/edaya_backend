import type { PinoLogger } from "hono-pino";

import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";
import type { ActorMetadata } from "@edaya/authorization";
import type { IdentityClient } from "../identity/server/index";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
    apiRuntime?: ApiRuntime;
    schoolApp: ApiSchoolApplication;
    identityClient: IdentityClient;
    actor: ActorMetadata | null;
  };
}
