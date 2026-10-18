/** True when a write failed because it would duplicate a UNIQUE column (e.g. an email that already exists). */
export function isUniqueConstraintError(err: unknown): boolean {
  const error = err as { code?: string; cause?: { code?: string } } | null;
  // Drizzle may wrap the driver error, so check the cause too.
  return (
    error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.cause?.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
