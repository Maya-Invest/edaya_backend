import type { AuthContactResolverPort } from "@edaya/core";
import { user } from "@edaya/betterauth-d1-migrations/schema";
import { eq } from "drizzle-orm";

type AuthDatabase = {
  select: (fields: { email: typeof user.email }) => {
    from: (table: typeof user) => {
      where: (condition: ReturnType<typeof eq>) => {
        limit: (count: number) => Promise<Array<{ email: string }>>;
      };
    };
  };
};

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
  };
}
