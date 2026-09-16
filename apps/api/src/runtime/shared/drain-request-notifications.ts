import type { Context } from "hono";
import type { AppBindings } from "@/http/bindings";
import type { ApiRuntime } from "@/runtime/types";

/** Send queued school notifications and invitations after the request has committed. */
export async function drainRequestNotifications(
  runtime: ApiRuntime | undefined,
  c: Context<AppBindings>,
): Promise<void> {
  if (!runtime?.drainNotifications) {
    return;
  }

  try {
    await runtime.drainNotifications();
  }
  catch (error) {
    c.var.logger?.error?.({ err: error }, "notification drain failed");
  }
}
