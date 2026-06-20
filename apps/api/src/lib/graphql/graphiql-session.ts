import type { Context } from "hono";
import { isInteractiveActor, resolveAuditActorId } from "@edaya/core";
import type { AppBindings } from "@/http/types";
import { type AuthSession, normalizeAuthSession } from "@/http/dependencies/session-actor";
import { isGraphiQLEnabled } from "@/lib/graphql/graphiql";

export async function handleGraphiQLSession(c: Context<AppBindings>) {
  if (!isGraphiQLEnabled(c.env?.NODE_ENV)) {
    return c.json({ message: "GraphiQL session is disabled" }, 404);
  }

  const auth = c.get("auth");
  const session = normalizeAuthSession(await auth.api.getSession({
    headers: c.req.raw.headers,
  }) as AuthSession | null | undefined);
  const actor = c.get("actor");

  return c.json({
    session: session
      ? {
          userId: session.user.id,
          email: session.user.email ?? null,
          name: session.user.name ?? null,
        }
      : null,
    actor: actor && isInteractiveActor(actor)
      ? {
          kind: actor.kind,
          actorId: resolveAuditActorId(actor),
          schoolId: actor.schoolId,
        }
      : null,
  });
}
