ALTER TABLE schools ADD COLUMN finance_currency text;
--> statement-breakpoint
ALTER TABLE schools ADD CONSTRAINT schools_finance_currency_check CHECK (finance_currency IS NULL OR finance_currency ~ '^[A-Z]{3}$');
