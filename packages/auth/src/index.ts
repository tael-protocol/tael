// @tael/auth — Sign-In-With-Stellar authentication primitives.
// Issues signing challenges and mints/verifies session tokens (JWT via jose).
// jose-only and edge-safe: no Stellar SDK here, so `verifySessionToken` can run
// in Next.js middleware. Wallet-signature verification lives in @tael/stellar and
// is composed at the route-handler (Node) layer.
export * from "./challenge";
export * from "./session";
export * from "./connect-token";
