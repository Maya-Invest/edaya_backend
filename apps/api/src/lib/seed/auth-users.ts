import type { Environment } from "@/lib/bootstrap/env";
import type { AuthService } from "@/lib/runtime/types";

export interface DevAuthAccount {
  email: string;
  password: string;
  name: string;
}

interface AuthUserResponse {
  user?: {
    id?: string;
  };
}

export async function ensureAuthUser(
  auth: AuthService,
  env: Environment,
  account: DevAuthAccount,
): Promise<string> {
  const signInResponse = await auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  }));

  if (signInResponse.ok) {
    const signInBody = await signInResponse.json() as AuthUserResponse;
    const userId = signInBody.user?.id;
    if (userId) {
      return userId;
    }
  }

  const signUpResponse = await auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      name: account.name,
    }),
  }));

  if (!signUpResponse.ok) {
    const message = await signUpResponse.text();
    throw new Error(`Failed to provision dev auth user ${account.email}: ${signUpResponse.status} ${message}`);
  }

  const signUpBody = await signUpResponse.json() as AuthUserResponse;
  const userId = signUpBody.user?.id;
  if (!userId) {
    throw new Error(`Better Auth sign-up for ${account.email} did not return a user id`);
  }

  return userId;
}
