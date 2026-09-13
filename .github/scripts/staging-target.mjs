export const staging = Object.freeze({
  account: "ca013c820d015639e8769dc09e2566ec",
  databaseHost: "ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech",
  schoolDatabase: "neondb",
  identityDatabase: "edaya_identity",
  schoolHyperdrive: "c6b9a94e449647d78f7c49591ba301e6",
  identityHyperdrive: "e08656297f69446c8eea3d1ded0268d5",
  authKv: "5a94d81b83d54a3cb5210f8f4e027d02",
  queue: "edaya-cron-jobs-staging",
  bucket: "edaya-files-staging",
  urls: {
    identity: "https://staging.identity.edayaplus.com",
    api: "https://staging.api.school.edayaplus.com",
    webapp: "https://staging.app.school.edayaplus.com",
    webadmin: "https://staging.admin.edayaplus.com",
  },
});

export function releaseOptions(env) {
  if (env.RELEASE_TARGET !== "staging") throw new Error("Only staging releases are allowed");
  if (!["false", "true"].includes(env.RESET_DATA)) throw new Error("RESET_DATA must be explicit true or false");
  if (env.CLOUDFLARE_ACCOUNT_ID !== staging.account) throw new Error("Unexpected Cloudflare account");
  const school = databaseTarget(env.STAGING_DATABASE_URL, staging.schoolDatabase);
  const identity = databaseTarget(env.STAGING_AUTH_DATABASE_URL, staging.identityDatabase);
  if (identity.username !== "edaya_identity") throw new Error("Identity must use its dedicated role");
  return { reset: env.RESET_DATA === "true", school, identity };
}

export function databaseTarget(value, database) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Missing or invalid staging database URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || url.hostname !== staging.databaseHost || url.pathname !== `/${database}`
    || (url.port && url.port !== "5432") || !url.username || !url.password
    || !["require", "verify-full"].includes(url.searchParams.get("sslmode"))) {
    throw new Error("Database must match the recorded direct staging endpoint, database, and TLS configuration");
  }
  return url;
}

export function assertHyperdrive(config, database, role) {
  if (config.origin.host !== staging.databaseHost || config.origin.database !== database
    || (role && config.origin.user !== role) || config.caching?.disabled !== true) {
    throw new Error("Hyperdrive does not match the recorded staging database with caching disabled");
  }
}
