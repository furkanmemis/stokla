/** Messages raised by our database functions are written for users; anything else gets a generic text. */
export function dbMessage(e: { code?: string; message?: string } | null, fallback: string): string {
  return e?.code === "P0001" && e.message ? e.message : fallback;
}
