import type { AuthContactResolverPort } from "@edaya/core";
import { user } from "@edaya/betterauth-d1-migrations/schema";
import { eq } from "drizzle-orm";

interface AuthDatabase {
  select: (fields: Record<string, unknown>) => {
    from: (table: typeof user) => {
      where: (condition: ReturnType<typeof eq>) => {
        limit: (count: number) => Promise<Array<Record<string, unknown>>>;
      };
    };
  };
}

export async function authAccountExistsForEmail(db: AuthDatabase, email: string): Promise<boolean> {
  const normalized = email.trim();
  if (!normalized) {
    return false;
  }

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  return rows.length > 0;
}

export function createAuthContactResolver(db: AuthDatabase): AuthContactResolverPort {
  return {
    async resolveBySubjectId(subjectId: string) {
      const rows = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, subjectId))
        .limit(1);

      const email = rows[0]?.email?.trim();
      return email ? { email } : undefined;
    },
    hasAccountForEmail: (email: string) => authAccountExistsForEmail(db, email),
  };
}
