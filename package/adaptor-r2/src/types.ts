export interface R2Environment {
  R2_ACCOUNT_ID?: string;
  /** Jurisdiction-specific S3 API endpoint from the R2 dashboard. Authoritative for S3 calls; may differ from R2_ACCOUNT_ID. */
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}
