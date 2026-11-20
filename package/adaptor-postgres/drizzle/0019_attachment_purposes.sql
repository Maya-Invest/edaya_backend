ALTER TABLE attachments ADD COLUMN purpose text NOT NULL DEFAULT 'general';
--> statement-breakpoint
ALTER TABLE attachments ADD CONSTRAINT attachments_purpose_valid CHECK
  (length(purpose) <= 100 AND purpose ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$');
--> statement-breakpoint
CREATE FUNCTION attachment_purpose_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose IS DISTINCT FROM OLD.purpose THEN
    RAISE EXCEPTION 'Attachment purpose is immutable' USING ERRCODE = '23514', CONSTRAINT = 'attachments_purpose_immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER attachment_purpose_immutable BEFORE UPDATE OF purpose ON attachments
  FOR EACH ROW EXECUTE FUNCTION attachment_purpose_immutable();
