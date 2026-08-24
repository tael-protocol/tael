/**
 * Convert light Markdown (what LLMs usually emit) into Telegram HTML.
 * Telegram's legacy Markdown parse mode often fails on `**bold**` and falls
 * back to plain text — HTML is more reliable.
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Escape then apply a small set of Markdown → HTML transforms.
 * Unsupported Markdown is left as visible text (already escaped).
 */
export function markdownToTelegramHtml(input: string): string {
  const escaped = escapeHtml(input);

  // Fenced code blocks first (greedy non-nested).
  let out = escaped.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_m, code: string) => {
    return `<pre>${code.replace(/^\n+|\n+$/g, "")}</pre>`;
  });

  // Inline code
  out = out.replace(/`([^`\n]+)`/g, (_m, code: string) => `<code>${code}</code>`);

  // Bold **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/__([^_]+)__/g, "<b>$1</b>");

  // Italic *text* (single asterisk, not part of **)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");

  // Links [label](url) — only http(s)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');

  return out;
}
