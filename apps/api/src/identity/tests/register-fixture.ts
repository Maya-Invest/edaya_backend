import type { AccountService, TermsAcceptanceInput } from "@edaya/account";

export async function verifyFixture(accounts: AccountService, challenge: string, code: string, termsAcceptance?: TermsAcceptanceInput) {
  const result = await accounts.verify(challenge, code);
  return result.state === "registration_required"
    ? accounts.completeRegistration({ challenge, proof: result.proof, termsAcceptance })
    : result;
}
