/**
 * postgres.js defaults ssl to false unless the URL has sslmode. Managed hosts
 * (Supabase pooler, Neon) require TLS.
 */
export function sslForConnectionString(url: string): "require" | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host.endsWith(".supabase.co") ||
      host.endsWith(".supabase.com") ||
      host.endsWith(".neon.tech")
    ) {
      return "require";
    }
  } catch {
    return undefined;
  }
  return undefined;
}
