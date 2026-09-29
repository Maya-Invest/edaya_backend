import type { Environment } from "./env";
import { createAccountRepository } from "@edaya/adaptor-account";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const fixtureAccountsSchema = z.array(z.object({ email: z.string().email().transform(value => value.trim().toLowerCase()), name: z.string().min(1) }).strip()).min(1).max(1000).superRefine((accounts, context) => {
  if (new Set(accounts.map(a => a.email)).size !== accounts.length)
    context.addIssue({ code: "custom", message: "Duplicate fixture email" });
});
/** Administrative fixture creation, never mounted on HTTP. No password or session is provisioned. */
export async function provisionFixtureAccounts(db: unknown, _env: Pick<Environment, "NODE_ENV">, input: unknown): Promise<number> {
  const accounts = fixtureAccountsSchema.parse(input);
  const { repository } = createAccountRepository(db);
  await repository.transaction(async () => {
    for (const fixture of accounts) {
      if (await repository.find("email", fixture.email))
        continue;
      const id = randomUUID();
      const now = Date.now();
      await repository.save({ id, status: "active", name: fixture.name, createdAt: now, securityVersion: 0, identifiers: [{ id: randomUUID(), kind: "email", value: fixture.email, verifiedAt: now, recoveryEligible: true }] });
      await repository.audit(id, "administrative_fixture_created", now);
    }
  });
  return accounts.length;
}
export { assertStagingFixtureTarget } from "@edaya/adaptor-auth";
