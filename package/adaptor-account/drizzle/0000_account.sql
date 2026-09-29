CREATE SCHEMA IF NOT EXISTS identity;
--> statement-breakpoint
CREATE TABLE identity.account (id text PRIMARY KEY, status text NOT NULL CHECK (status IN ('active','disabled')), name text NOT NULL DEFAULT '', security_version integer NOT NULL DEFAULT 0, created_at bigint NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.identifier (id text PRIMARY KEY, account_id text NOT NULL REFERENCES identity.account(id), kind text NOT NULL CHECK (kind IN ('email','phone')), value text NOT NULL, verified_at bigint NOT NULL, recovery_eligible boolean NOT NULL, revoked_at bigint);
--> statement-breakpoint
CREATE UNIQUE INDEX identifier_active_value ON identity.identifier(kind,value) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE INDEX identifier_account ON identity.identifier(account_id);
--> statement-breakpoint
CREATE TABLE identity.security (account_id text PRIMARY KEY REFERENCES identity.account(id), data jsonb NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.provider_link (provider text NOT NULL, subject text NOT NULL, account_id text NOT NULL REFERENCES identity.account(id), kind text NOT NULL, value text NOT NULL, PRIMARY KEY(provider,subject));
--> statement-breakpoint
CREATE TABLE identity.session (digest text PRIMARY KEY, account_id text NOT NULL REFERENCES identity.account(id), expires_at bigint NOT NULL, data jsonb NOT NULL);
--> statement-breakpoint
CREATE INDEX session_account ON identity.session(account_id);
--> statement-breakpoint
CREATE TABLE identity.challenge (id text PRIMARY KEY, kind text NOT NULL, value text NOT NULL, expires_at bigint NOT NULL, data jsonb NOT NULL);
--> statement-breakpoint
CREATE INDEX challenge_recipient ON identity.challenge(kind,value);
--> statement-breakpoint
CREATE TABLE identity.pending (digest text PRIMARY KEY, account_id text NOT NULL REFERENCES identity.account(id), expires_at bigint NOT NULL, data jsonb NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.quota (key text PRIMARY KEY, count integer NOT NULL, expires_at bigint NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.security_event (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, account_id text NOT NULL REFERENCES identity.account(id), event text NOT NULL, created_at bigint NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.jwks (id text PRIMARY KEY, public_key text NOT NULL, private_key text NOT NULL, created_at timestamptz NOT NULL, alg text);
