ALTER TABLE notify.devices RENAME TO devices_pre_installation;
--> statement-breakpoint
CREATE TABLE notify.devices (
 tenant text NOT NULL, subject_id text NOT NULL, provider text NOT NULL,
 app_id text NOT NULL, installation_id text NOT NULL,
 profile_kind text NOT NULL, profile_id text NOT NULL, token text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant, subject_id, provider, app_id, installation_id)
);
