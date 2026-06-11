import { buildCommandRoutes } from "./commands";
import { buildEntityRoutes } from "./entities";
import { buildQueryRoutes } from "./queries";
import type { SchoolApiRoutePair } from "./shared";

export { buildCommandRoutes } from "./commands";
export { buildEntityRoutes } from "./entities";
export { buildQueryRoutes } from "./queries";
export type { SchoolApiRoutePair } from "./shared";

export function buildCoreRoutes(): SchoolApiRoutePair[] {
  return [
    ...buildCommandRoutes(),
    ...buildQueryRoutes(),
    ...buildEntityRoutes(),
  ];
}
