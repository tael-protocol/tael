<div align="center">

# ✦ Tael

**The payment layer for autonomous AI agents**

**Pay for any API. Get paid for yours.**

Agents, MCP tools, and APIs supported. Payments settled in USDC.

[Read the Docs](https://taelprotocol.xyz/docs) &nbsp;·&nbsp;
[Live app](https://app.taelprotocol.xyz) &nbsp;·&nbsp;
[Website](https://taelprotocol.xyz)

</div>

<p align="center">
  <a href="https://www.npmjs.com/package/@tael/sdk"><img alt="npm version" src="https://img.shields.io/npm/v/@tael/sdk?logo=npm&label=%40tael%2Fsdk&color=000000" /></a>
  <a href="https://github.com/tael-protocol/tael/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/tael-protocol/tael?logo=github&color=000000" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-000000.svg" /></a>
  <a href="https://discord.gg/UtW9dZKwBW"><img alt="Discord community" src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white" /></a>
  <a href="https://x.com/taelprotocol"><img alt="Follow @taelprotocol" src="https://img.shields.io/badge/Follow-%40taelprotocol-000000?logo=x&logoColor=white" /></a>
  <a href="https://stellar.org"><img alt="Built on Stellar" src="https://img.shields.io/badge/Built%20on-Stellar-000000?logo=stellar&logoColor=white" /></a>
</p>

---

## What is Tael?

Tael is a programmable payment layer that lets autonomous AI agents purchase APIs, MCP tools,
datasets, and digital services using **USDC on Stellar**. Developers wrap any HTTP handler with one
SDK call to monetize it; agents discover those capabilities, pay per request within user-defined
spending policies, and keep working without a human in the loop.

It speaks the open **x402 / HTTP 402** standard, so a paid endpoint is just a normal web request with
a payment attached.

## Why Tael?

AI agents can reason, plan, and act — but they still can't pay for the services they need. Every paid
API assumes a human with a credit card. Tael closes that gap.

1. **Agents pay per call, not per subscription.** No accounts, no API-key juggling, no monthly plans.
   An agent settles a micropayment for exactly what it uses, and continues.

2. **Developers monetize in one line.** Wrap an existing handler with `tael()` and get paid in USDC on
   every call — no Stripe, no billing logic, no invoices, no customer accounts.

3. **Spending stays under control.** Every agent runs on a funded hot wallet with on-chain caps
   (max-per-call + rolling limits), so autonomy never means a blank cheque.

## How it works

```
Agent calls a capability
        │
        ▼
HTTP 402 Payment Required   ← the gateway returns a payment challenge
        │
        ▼
Agent signs a USDC payment  ← within its spending policy
        │
        ▼
Settles on Stellar          ← verified on-chain before anything runs
        │
        ▼
Handler executes → response + signed receipt
```

Payment is verified on-chain **before** your handler runs, and a signed `X-PAYMENT-RESPONSE` receipt is
returned with the response. Settlement is non-custodial: the agent pays the builder and a 1% protocol
fee in a single transaction.

## Getting started

### Monetize an API — for developers

Wrap any Fetch handler in one call. Because it speaks the Web `Request`/`Response` standard, it drops
into Hono, Next.js route handlers, Bun, Deno, and Cloudflare Workers unchanged.

```ts
import { tael } from "@tael/sdk";

// Every call now requires a $0.02 USDC payment before `myApi` runs.
export default tael({
  price: "0.02",
  handler: myApi,
});
```

That's it — no billing, no Stripe, no customer accounts. Just get paid every time your API is called.

### Buy a capability — for agents

From the [dashboard](https://app.taelprotocol.xyz): create an agent, fund its hot wallet with USDC,
and set a spending policy (max-per-call + a rolling limit). The agent then discovers capabilities in
the marketplace and pays for them autonomously — each call settles on-chain, within the caps you set,
and shows up in your ledger.

## Packages

A Turborepo + pnpm monorepo. The payment engine is chain-agnostic; Stellar is the first settlement
backend.

| Package                                                | What it does                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`@tael/sdk`](https://www.npmjs.com/package/@tael/sdk) | Buy, publish, and sell capabilities from code: the `Tael` client + the `tael()` wrapper |
| `@tael/payments`                                       | x402 protocol wire format + non-custodial fee split                                     |
| `@tael/stellar`                                        | Stellar settlement + the hardened on-chain payment verifier                             |
| `@tael/types`                                          | `Money` value object, zod schemas, shared errors                                        |
| `@tael/auth`                                           | Sign-In-With-Stellar sessions (edge-safe, `jose`)                                       |
| `@tael/database`                                       | Drizzle schema + AES-256-GCM secret encryption                                          |
| `@tael/ui`                                             | Shared React components (shadcn/ui-based)                                               |
| `@tael/config`                                         | Shared TypeScript / Tailwind / ESLint config                                            |
| `@tael/claude`                                         | AI helpers (e.g. capability FAQ generation)                                             |

Apps: **`web`** (marketing site), **`dashboard`** (the console), **`api`** (the capability gateway).

## Build and run from source

```bash
git clone https://github.com/tael-protocol/tael.git
cd tael-protocol
pnpm install
cp .env.example .env   # add your keys (Stellar, database, auth secret)
pnpm dev               # runs the web, dashboard, and api in parallel
```

Useful scripts:

```bash
pnpm build         # build every app and package
pnpm test          # run the test suites
pnpm typecheck     # type-check the whole monorepo
pnpm format        # format with Prettier
```

## Documentation

Full docs live at **[taelprotocol.xyz/docs](https://taelprotocol.xyz/docs)** — the SDK, accepting
payments, spending policies, and the gateway.

## Community

- **Discord** — [join the community](https://discord.gg/UtW9dZKwBW)
- **X** — [@taelprotocol](https://x.com/taelprotocol)
- **Docs** — [taelprotocol.xyz/docs](https://taelprotocol.xyz/docs)

## Contributing

> [!NOTE]
> We value contributions. For questions or support, join our
> [Discord community](https://discord.gg/UtW9dZKwBW).

Bug fixes and small improvements are the best way to get started. For larger features, please open an
issue or reach out on Discord first so we can make sure it aligns with the roadmap.

## License

Licensed under the [MIT License](./LICENSE).
