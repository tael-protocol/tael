/** Cap for stored website body text (~100KB). */
export const MAX_BODY_BYTES = 100 * 1024;

/** Strip scripts/styles/tags and collapse whitespace into readable text. */
export function htmlToText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    // Truncate on a character boundary under the byte cap.
    let end = Math.min(text.length, MAX_BODY_BYTES);
    while (end > 0 && Buffer.byteLength(text.slice(0, end), "utf8") > MAX_BODY_BYTES) {
      end -= 1;
    }
    text = text.slice(0, end).trimEnd() + "\n…";
  }
  return text;
}

export function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return fallback;
  const title = match[1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return title || fallback;
}
