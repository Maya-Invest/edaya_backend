-- Install the same historical lookup column on databases that ran the original
-- empty-only 0054. Those databases had no subject codes to carry forward.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS legacy_code text;
