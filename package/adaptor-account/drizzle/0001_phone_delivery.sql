CREATE TABLE identity.otp_cooldown (value text PRIMARY KEY, expires_at bigint NOT NULL, data jsonb NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.otp_request (id text PRIMARY KEY, fingerprint text NOT NULL, challenge text NOT NULL, expires_at bigint NOT NULL);
--> statement-breakpoint
CREATE TABLE identity.otp_receipt (id text PRIMARY KEY, message_id text NOT NULL, expires_at bigint NOT NULL, data jsonb NOT NULL);
--> statement-breakpoint
CREATE INDEX otp_receipt_message_idx ON identity.otp_receipt (message_id);
--> statement-breakpoint
CREATE INDEX otp_cooldown_expiry_idx ON identity.otp_cooldown (expires_at);
--> statement-breakpoint
CREATE INDEX otp_request_expiry_idx ON identity.otp_request (expires_at);
--> statement-breakpoint
CREATE INDEX otp_receipt_expiry_idx ON identity.otp_receipt (expires_at);
--> statement-breakpoint
CREATE INDEX challenge_delivery_message_idx ON identity.challenge ((data->>'messageId'));
