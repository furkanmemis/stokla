import { redirect } from "next/navigation";

/** Trimmed, length-capped text field. */
export function text(fd: FormData, key: string, max = 200): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

/** Decimal field that accepts a Turkish comma ("2,5"). Returns NaN when empty or invalid. */
export function decimal(fd: FormData, key: string): number {
  const raw = String(fd.get(key) ?? "").trim().replace(",", ".");
  return raw === "" ? NaN : Number(raw);
}

/** Redirects back to `path` with a one-off message in the query string (shown by <Alert>). */
export function redirectWith(path: string, kind: "error" | "ok", message: string): never {
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}${kind}=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`);
}
