ALTER TABLE auth."user" ADD COLUMN phone_number text UNIQUE;
--> statement-breakpoint
ALTER TABLE auth."user" ADD COLUMN phone_number_verified boolean DEFAULT false;
