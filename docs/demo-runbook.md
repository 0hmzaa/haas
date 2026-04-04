# HumanAsAService Demo Runbook

## 1. Prerequisites
- Initialize local env file once:
  - `pnpm env:init`
  - then edit `.env` with your real credentials
- Start PostgreSQL and app services (for example via Docker Compose).
- Ensure API is reachable on `http://localhost:4000`.
- Set `HEDERA_SCHEDULE_ADMIN_KEY` in environment (required for review timeout schedules).
- If `HEDERA_ENABLED=true`, configure operator/topic envs and ensure workers are onboarded with Hedera-style `walletAddress` (format `0.0.x`).
- For World ID, keep `WORLD_ID_MODE=mock` for local demo, or switch to `WORLD_ID_MODE=live` with `WORLD_ID_VERIFY_URL`/`WORLD_ID_APP_ID`.
- x402 webhooks are signed by default; align API + demo script with the same `X402_FACILITATOR_ID` and `X402_FACILITATOR_SIGNING_SECRET`.
- Optional strict mode: set `X402_VERIFY_HEDERA_TX=true` to require Mirror Node confirmation of `hederaTxId` for successful funding webhooks.

## 2. Secret Retrieval Guide

### Hedera (Testnet)
- `HEDERA_OPERATOR_ACCOUNT_ID`: get the Testnet operator account id (`0.0.x`) from your Hedera wallet/portal.
- `HEDERA_OPERATOR_PRIVATE_KEY`: get the private key for that operator account (never commit it).
- `HEDERA_ESCROW_ACCOUNT_ID`: Hedera account used by the platform to hold locked funds (for MVP this can be the same as the operator account).
- `HEDERA_HCS_TOPIC_ID`: create an HCS topic on Testnet, then copy its topic id (`0.0.x`).
- `HEDERA_SCHEDULE_ADMIN_KEY`: admin private key used to create/delete scheduled transactions (required to cancel auto-release in disputes).
- `HEDERA_MIRROR_NODE_BASE_URL`: optional, leave empty to use default Testnet mirror URL.

### World ID (live)
- `WORLD_ID_MODE=live`
- `WORLD_ID_APP_ID`: created in the World dashboard for your app.
- `WORLD_ID_API_KEY`: backend verification key linked to that app.
- `WORLD_ID_VERIFY_URL`: either the verification URL provided by World, or one derived from `WORLD_ID_APP_ID` depending on the verify endpoint you use.
- `WORLD_VERIFY_PAYLOAD_FILE`: local JSON file containing `session_id`, `nullifier_hash`, `proof`, and optional `walletAddress`.

Minimal World payload example (`world-verify-payload.json`):

```json
{
  "session_id": "session-live-001",
  "nullifier_hash": "nullifier-live-001",
  "walletAddress": "0.0.123456",
  "proof": {
    "valid": true
  }
}
```

### x402 / Facilitator
- `X402_FACILITATOR_ID`: facilitator identifier used to sign and submit funding.
- `X402_FACILITATOR_SIGNING_SECRET`: shared secret used for x402 webhook HMAC signatures.
- `X402_REQUIRE_SIGNED_WEBHOOK=true`
- `X402_VERIFY_HEDERA_TX=true` recommended for real runs.
- `X402_MIRROR_NODE_BASE_URL`: optional, otherwise fallback to Hedera mirror config.

### Real E2E Run Values
- `REAL_HEDERA_TX_ID`: real Hedera funding transaction id (from the facilitator flow).
- `REAL_PAYER_ACCOUNT`: real Hedera payer account (`0.0.x`).
- `REAL_ORDER_AMOUNT`, `REAL_ORDER_CURRENCY`, `REAL_CLIENT_ID`: scenario parameters.

### Checklist Before Real Run
- `.env` is filled and not versioned.
- API is started with these variables.
- Worker is created with a valid Hedera `walletAddress` (`0.0.x`).
- `WORLD_VERIFY_PAYLOAD_FILE` points to an existing file.

## 3. Quality Gate Before Demo
Run:

```bash
pnpm lint
pnpm build
```

## 4. Execute Demo Script
Approve flow (default):

```bash
pnpm demo:happy-path
```

Dispute flow:

```bash
pnpm demo:happy-path dispute
```

Auto-release preparation flow:

```bash
pnpm demo:happy-path auto
```

Real credentials E2E (World live + signed x402 + Hedera tx id):

```bash
pnpm demo:real-e2e
```

Required env for `demo:real-e2e`:
- `WORLD_VERIFY_PAYLOAD_FILE` path to a JSON payload containing `session_id`, `nullifier_hash`, `proof`, and optional `walletAddress`.
- `X402_FACILITATOR_ID`
- `X402_FACILITATOR_SIGNING_SECRET`
- `REAL_HEDERA_TX_ID`
- `REAL_PAYER_ACCOUNT`

Recommended real-mode env:
- `WORLD_ID_MODE=live`
- `HEDERA_ENABLED=true`
- `X402_REQUIRE_SIGNED_WEBHOOK=true`
- `X402_VERIFY_HEDERA_TX=true`

## 5. What the Script Covers
- Worker onboarding (`/api/world/verify` + `/api/workers`)
- Order creation
- x402-style payment requirement generation
- Funding confirmation webhook
- Order start
- Proof upload with local storage + hash
- Branch handling:
  - `approve`: direct approval path
  - `dispute`: opens dispute + submits majority reviewer votes
  - `auto`: uses `reviewWindowHours=0` and simulates a `RELEASE` Hedera webhook to demonstrate timeout auto-release end-to-end in one run
- Dispute flow supports worker response update through `POST /api/orders/:id/dispute/respond`.
- Audit timeline fetch (`/api/orders/:id/audit`)

## 6. Manual Checks
- `GET /api/orders/:id` to verify final status.
- `GET /api/orders/:id/audit` to inspect lifecycle chronology.
- `GET /api/reputation/workers/:id` and `GET /api/reputation/reviewers/:id` to inspect score updates.
