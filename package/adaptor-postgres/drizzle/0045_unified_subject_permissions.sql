-- Permission data must be explicitly backed up and reset before this cutover.
-- Academic data, profile definitions and teaching assignments are untouched.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT scopes FROM staff_permission_assignments
      UNION ALL SELECT scopes FROM staff_permission_scope_defaults
      UNION ALL SELECT custom_scopes FROM staff_manual_permission_assignments
      UNION ALL SELECT custom_scopes FROM staff_permission_profile_bindings
    ) saved CROSS JOIN LATERAL jsonb_array_elements(saved.scopes) scope
    WHERE scope->>'kind' = 'class_subject'
      OR (scope->>'kind' = 'all' AND scope->>'grain' = 'class_subject')
  ) THEN
    RAISE EXCEPTION 'Unified Subject permissions require an explicit permission reset. Back up and reset grants, defaults, manual assignments and profile bindings, then retry and reseed. Academic records, profile definitions and teaching assignments must be preserved.';
  END IF;
END $$;
