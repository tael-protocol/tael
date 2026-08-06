import { Tael } from "@tael/sdk";

/** The buy-side SDK client the bot uses to call capabilities and pay per call. */
export function makeClient(apiKey: string, baseUrl?: string): Tael {
  return new Tael({ apiKey, ...(baseUrl ? { baseUrl } : {}) });
}
