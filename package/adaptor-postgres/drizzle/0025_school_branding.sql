ALTER TABLE "schools"
  ADD COLUMN "public_branding_purposes" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private_file_object_is_referenced(key text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM private_file_objects WHERE storage_key = key AND legacy_alias_held)
    OR EXISTS (SELECT 1 FROM private_file_objects WHERE storage_key <> key AND private_file_key_family(storage_key) = private_file_key_family(key))
    OR EXISTS (SELECT 1 FROM private_file_references WHERE storage_key = key)
    OR EXISTS (SELECT 1 FROM attachments WHERE storage_key = key)
    OR EXISTS (SELECT 1 FROM students WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (SELECT 1 FROM guardians WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (SELECT 1 FROM staff_members WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (SELECT 1 FROM teachers WHERE position(key IN private_file_decode_url(photo_url)) > 0)
    OR EXISTS (
      SELECT 1 FROM schools s
      JOIN attachments a ON a.school_id = s.id AND a.id IN (s.logo_attachment_id, s.crest_attachment_id, s.stamp_attachment_id, s.signature_attachment_id)
      WHERE a.storage_key = key
    )
    OR EXISTS (
      SELECT 1 FROM document_issuances d
      JOIN attachments a ON a.school_id = d.school_id AND a.id IN (
        d.snapshot->>'logoAttachmentId',
        d.snapshot->>'crestAttachmentId',
        d.snapshot->>'stampAttachmentId',
        d.snapshot->>'signatureAttachmentId',
        d.snapshot->>'portraitAttachmentId'
      )
      WHERE a.storage_key = key
    );
$$;
