// Simple in-memory guardrail: a per-user sliding window plus a global daily cap.
// Single-instance (fine for one bot process); a shared store would be the
// multi-instance follow-up, same as the gateway's limiter.

export class Guard {
  private readonly hits = new Map<string, number[]>();
  private day = { date: "", count: 0 };

  constructor(
    private readonly perUserPerMinute: number,
    private readonly dailyCap: number,
  ) {}

  /** Returns { ok } if the call is allowed, or { ok: false, reason } to show the user. */
  check(userId: string): { ok: true } | { ok: false; reason: string } {
    const now = Date.now();

    const today = new Date().toISOString().slice(0, 10);
    if (this.day.date !== today) this.day = { date: today, count: 0 };
    if (this.day.count >= this.dailyCap) {
      return { ok: false, reason: "The bot has hit its daily call cap. Try again tomorrow." };
    }

    const recent = (this.hits.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.perUserPerMinute) {
      return { ok: false, reason: `Slow down. Max ${this.perUserPerMinute} calls per minute.` };
    }

    recent.push(now);
    this.hits.set(userId, recent);
    this.day.count += 1;
    return { ok: true };
  }
}
