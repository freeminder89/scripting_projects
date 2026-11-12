/** Keep native error details visible, including non-Error rejection values. */
export function formatError(error: unknown): string {
  if (error instanceof Error) return error.stack || String(error)
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error, null, 2) ?? String(error)
  } catch {
    return String(error)
  }
}
