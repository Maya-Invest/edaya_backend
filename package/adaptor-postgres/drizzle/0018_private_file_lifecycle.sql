CREATE TABLE private_file_objects (
  id text PRIMARY KEY,
  school_id text NOT NULL REFERENCES schools(id),
  storage_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'deleting', 'deleted')),
  protected_until timestamptz NOT NULL,
  delete_job_id text,
  deleted_at timestamptz,
  legacy_alias_held boolean NOT NULL DEFAULT false,
  CHECK ((status = 'reserved' AND delete_job_id IS NULL AND deleted_at IS NULL)
    OR (status = 'deleting' AND delete_job_id IS NOT NULL)
    OR (status = 'deleted' AND delete_job_id IS NOT NULL AND deleted_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX private_file_objects_due ON private_file_objects (school_id, protected_until, id);
--> statement-breakpoint
CREATE TABLE private_file_references (
  source_type text NOT NULL,
  source_id text NOT NULL,
  slot text NOT NULL,
  school_id text NOT NULL REFERENCES schools(id),
  attachment_id text REFERENCES attachments(id) ON DELETE RESTRICT,
  storage_key text REFERENCES private_file_objects(storage_key) ON DELETE RESTRICT,
  PRIMARY KEY (school_id, source_type, source_id, slot),
  CHECK (attachment_id IS NOT NULL OR storage_key IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX private_file_references_attachment ON private_file_references (attachment_id);
--> statement-breakpoint
CREATE INDEX private_file_references_object ON private_file_references (storage_key);
--> statement-breakpoint
CREATE FUNCTION private_file_key_family(key text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  -- Local disk metadata is a sidecar and some development volumes fold case or
  -- Unicode. Conservatively retain ambiguous imported key families on every provider.
  SELECT regexp_replace(normalize(lower(array_to_string(ARRAY(
    SELECT part FROM unnest(string_to_array(key, '/')) AS segments(part) WHERE part NOT IN ('', '.')
  ), '/')), NFC), '(\.meta\.json)+$', '');
$$;
--> statement-breakpoint
CREATE FUNCTION private_file_object_key_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('private-file-key:' || private_file_key_family(NEW.storage_key), 0));
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER private_file_object_key_lock BEFORE INSERT ON private_file_objects
  FOR EACH ROW EXECUTE FUNCTION private_file_object_key_lock();
--> statement-breakpoint
CREATE FUNCTION private_file_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_school text; target_status text;
BEGIN
  IF NEW.attachment_id IS NOT NULL THEN
    SELECT school_id INTO target_school FROM attachments WHERE id = NEW.attachment_id FOR KEY SHARE;
    IF target_school IS DISTINCT FROM NEW.school_id THEN RAISE EXCEPTION 'PRIVATE_FILE_REFERENCE_INVALID'; END IF;
  END IF;
  IF NEW.storage_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('private-file-key:' || private_file_key_family(NEW.storage_key), 0));
    IF EXISTS (SELECT 1 FROM private_file_objects WHERE private_file_key_family(storage_key) = private_file_key_family(NEW.storage_key) AND status <> 'reserved') THEN
      RAISE EXCEPTION 'PRIVATE_FILE_REFERENCE_UNAVAILABLE';
    END IF;
    SELECT school_id, status INTO target_school, target_status FROM private_file_objects WHERE storage_key = NEW.storage_key FOR UPDATE;
    IF target_school IS DISTINCT FROM NEW.school_id OR target_status IS DISTINCT FROM 'reserved' THEN
      RAISE EXCEPTION 'PRIVATE_FILE_REFERENCE_UNAVAILABLE';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER private_file_reference_guard BEFORE INSERT OR UPDATE ON private_file_references
  FOR EACH ROW EXECUTE FUNCTION private_file_reference_guard();
--> statement-breakpoint
CREATE FUNCTION private_file_attachment_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    DELETE FROM private_file_references WHERE school_id = OLD.school_id AND source_type = 'attachment' AND source_id = OLD.id;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.storage_key IS NOT NULL THEN
    -- Legacy metadata is retained indefinitely until explicitly detached. New
    -- upload/render commands reserve their objects with a bounded write window.
    INSERT INTO private_file_objects (id, school_id, storage_key, protected_until)
      VALUES (md5(random()::text || clock_timestamp()::text), NEW.school_id, NEW.storage_key, 'infinity')
      ON CONFLICT (storage_key) DO NOTHING;
    IF NEW.file_url IS NOT NULL THEN
      -- An opaque historical URL may have consumers that cannot be reconstructed
      -- from a storage key. Retain its bytes until the owning feature migrates it.
      UPDATE private_file_objects SET legacy_alias_held = true, protected_until = 'infinity'
        WHERE storage_key = NEW.storage_key AND status = 'reserved';
    END IF;
    INSERT INTO private_file_references (source_type, source_id, slot, school_id, storage_key)
      VALUES ('attachment', NEW.id, 'content', NEW.school_id, NEW.storage_key);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER private_file_attachment_sync AFTER INSERT OR UPDATE OR DELETE ON attachments
  FOR EACH ROW EXECUTE FUNCTION private_file_attachment_sync();
--> statement-breakpoint
CREATE FUNCTION private_file_decode_url(value text) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE result text;
BEGIN
  SELECT convert_from(decode(string_agg(CASE WHEN part[1] ~ '^%[0-9a-fA-F]{2}$'
    THEN substring(part[1] FROM 2) ELSE encode(convert_to(part[1], 'UTF8'), 'hex') END, '' ORDER BY position), 'hex'), 'UTF8')
    INTO result FROM regexp_matches(value, '%[0-9a-fA-F]{2}|.', 'g') WITH ORDINALITY AS tokens(part, position);
  RETURN result;
EXCEPTION WHEN OTHERS THEN RETURN value;
END $$;
--> statement-breakpoint
CREATE FUNCTION private_file_photo_sync() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE photo text; target_id text; object_record record;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    DELETE FROM private_file_references WHERE school_id = OLD.school_id AND source_type = TG_TABLE_NAME AND source_id = OLD.id;
  END IF;
  IF TG_OP = 'DELETE' OR NEW.photo_url IS NULL THEN RETURN NULL; END IF;
  photo := private_file_decode_url(NEW.photo_url);
  target_id := (regexp_match(photo, '/core/files/([^/?#]+)/content([?#].*)?$'))[1];
  IF target_id IS NOT NULL THEN
    INSERT INTO private_file_references (source_type, source_id, slot, school_id, attachment_id)
      VALUES (TG_TABLE_NAME, NEW.id, 'photo', NEW.school_id, target_id);
  END IF;
  -- Preserve direct legacy object URLs as well as canonical attachment URLs.
  -- A conservative match may retain an object; it must never authorize deletion.
  FOR object_record IN SELECT storage_key FROM private_file_objects
    WHERE position(storage_key IN photo) > 0 ORDER BY storage_key LOOP
    INSERT INTO private_file_references (source_type, source_id, slot, school_id, storage_key)
      VALUES (TG_TABLE_NAME, NEW.id, 'photo-key:' || object_record.storage_key, NEW.school_id, object_record.storage_key);
  END LOOP;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER private_file_student_photo AFTER INSERT OR UPDATE OR DELETE ON students FOR EACH ROW EXECUTE FUNCTION private_file_photo_sync();
--> statement-breakpoint
CREATE TRIGGER private_file_guardian_photo AFTER INSERT OR UPDATE OR DELETE ON guardians FOR EACH ROW EXECUTE FUNCTION private_file_photo_sync();
--> statement-breakpoint
CREATE TRIGGER private_file_staff_photo AFTER INSERT OR UPDATE OR DELETE ON staff_members FOR EACH ROW EXECUTE FUNCTION private_file_photo_sync();
--> statement-breakpoint
CREATE TRIGGER private_file_teacher_photo AFTER INSERT OR UPDATE OR DELETE ON teachers FOR EACH ROW EXECUTE FUNCTION private_file_photo_sync();
--> statement-breakpoint
UPDATE attachments SET storage_key = storage_key;
--> statement-breakpoint
UPDATE students SET photo_url = photo_url WHERE photo_url IS NOT NULL;
--> statement-breakpoint
UPDATE guardians SET photo_url = photo_url WHERE photo_url IS NOT NULL;
--> statement-breakpoint
UPDATE staff_members SET photo_url = photo_url WHERE photo_url IS NOT NULL;
--> statement-breakpoint
UPDATE teachers SET photo_url = photo_url WHERE photo_url IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION private_file_object_is_referenced(key text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM private_file_objects WHERE storage_key = key AND legacy_alias_held)
    OR EXISTS (SELECT 1 FROM private_file_objects WHERE storage_key <> key AND private_file_key_family(storage_key) = private_file_key_family(key))
    OR EXISTS (SELECT 1 FROM private_file_references WHERE storage_key = key)
    OR EXISTS (SELECT 1 FROM attachments WHERE storage_key = key)
    OR EXISTS (SELECT 1 FROM students WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (SELECT 1 FROM guardians WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (SELECT 1 FROM staff_members WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (SELECT 1 FROM teachers WHERE position(key IN private_file_decode_url(photo_url)) > 0);
$$;
