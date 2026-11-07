export const BUCKETS = {
  STORED_FILES: "storedFiles",
  TEMP_FILES: "temp",
} as const;

export const STORAGE_PATHS = {
  TRANSCRIPTIONS_TEMP: `${BUCKETS.TEMP_FILES}/transcriptions`,
  TRANSCRIPTIONS_PERMANENT: `${BUCKETS.STORED_FILES}/transcriptions`,
} as const;
