export interface LocalFileStorageEnvironment {
  LOCAL_FILES_URL?: string;
  LOCAL_FILES_ROOT?: string;
  LOCAL_FILES_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  TRUSTED_ORIGINS?: string;
}

export interface LocalFileStorageConfig {
  baseUrl: string;
  rootDir: string;
  secret: string;
  allowedOrigins?: string[];
}

export const DEFAULT_LOCAL_FILES_URL = "http://localhost:9200";
export const DEFAULT_LOCAL_FILES_ROOT = ".data/files";
export const DEFAULT_UPLOAD_TTL_SECONDS = 900;
export const DEFAULT_DOWNLOAD_TTL_SECONDS = 900;
