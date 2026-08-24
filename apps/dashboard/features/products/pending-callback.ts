/** Telegram callback_data: `c:<token>` (well under the 64-byte limit). */
export function buildPendingCallbackData(token: string): string {
  return `c:${token}`;
}

/** Parse `c:<token>` or legacy `a:<hex>:<params>` / `run_action:…`. */
export function parseActionCallbackData(
  data: string,
):
  | { kind: "pending"; token: string }
  | { kind: "legacy"; actionIdHex: string; paramsStr: string }
  | null {
  if (data.startsWith("c:")) {
    const token = data.slice(2).trim();
    if (!token) return null;
    return { kind: "pending", token };
  }

  if (data.startsWith("a:")) {
    const parts = data.slice(2).split(":");
    const actionIdHex = parts[0] ?? "";
    const paramsStr = parts.slice(1).join(":");
    if (!actionIdHex) return null;
    return { kind: "legacy", actionIdHex, paramsStr };
  }

  if (data.startsWith("run_action:")) {
    const parts = data.split(":");
    const actionIdHex = (parts[1] ?? "").replace(/-/g, "");
    const paramsStr = parts.slice(2).join(":");
    if (!actionIdHex) return null;
    return { kind: "legacy", actionIdHex, paramsStr };
  }

  return null;
}
