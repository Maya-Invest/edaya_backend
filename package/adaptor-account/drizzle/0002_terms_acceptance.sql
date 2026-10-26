CREATE TABLE identity.terms_acceptance (
  account_id text NOT NULL REFERENCES identity.account(id),
  version text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('fr', 'en')),
  document_hash text NOT NULL,
  accepted_at bigint NOT NULL,
  PRIMARY KEY (account_id, version)
);
