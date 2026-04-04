# HumanAsAService Demo Runbook

## 1. Prerequisites
- Initialize local env file once:
  - `pnpm env:init`
  - then edit `.env` with your real credentials
- Start PostgreSQL and app services (for example via Docker Compose).
- Ensure API is reachable on `http://localhost:4000`.
- Set `HEDERA_SCHEDULE_ADMIN_KEY` in environment (required for review timeout schedules).
- If your Hedera private keys are raw hex (`0x...`), you can force parsing mode with:
  - `HEDERA_OPERATOR_PRIVATE_KEY_TYPE=ecdsa|ed25519|auto`
  - `HEDERA_SCHEDULE_ADMIN_KEY_TYPE=ecdsa|ed25519|auto`
- If `HEDERA_ENABLED=true`, configure operator/topic envs and ensure workers are onboarded with Hedera-style `walletAddress` (format `0.0.x`).
- For on-chain dispute outcomes (`REFUND_CLIENT` / `SPLIT_PAYMENT`), include `clientAccountId` (`0.0.x`) when creating orders.
- For World ID, keep `WORLD_ID_MODE=mock` for local demo, or switch to `WORLD_ID_MODE=live` with `WORLD_ID_VERIFY_URL`/`WORLD_ID_APP_ID`.
- x402 webhooks are signed by default; align API + demo script with the same `X402_FACILITATOR_ID` and `X402_FACILITATOR_SIGNING_SECRET`.
- Optional strict mode: set `X402_VERIFY_HEDERA_TX=true` to require Mirror Node confirmation of `hederaTxId` for successful funding webhooks.
- Task policy gate is enabled by default with `TASK_POLICY_MODE=enforce`.
  - Use `warn` to allow flagged tasks with warnings.
  - Use `off` to disable policy checks.
- Automatic review-window reconciliation is enabled by default:
  - `AUTO_RECONCILIATION_ENABLED=true`
  - `AUTO_RECONCILIATION_INTERVAL_MS=30000`
  - `AUTO_RECONCILIATION_BATCH_SIZE=25`
  - `AUTO_RECONCILIATION_RUN_ON_START=true`

## 2. Secret Retrieval Guide

### Hedera (Testnet)
- `HEDERA_OPERATOR_ACCOUNT_ID`: get the Testnet operator account id (`0.0.x`) from your Hedera wallet/portal.
- `HEDERA_OPERATOR_PRIVATE_KEY`: get the private key for that operator account (never commit it).
- `HEDERA_OPERATOR_PRIVATE_KEY_TYPE`: optional, use `ecdsa` when your key is an ECDSA hex private key (`0x...`), `ed25519` for ED25519 hex, or `auto`.
- `HEDERA_ESCROW_ACCOUNT_ID`: Hedera account used by the platform to hold locked funds (for MVP this can be the same as the operator account).
- `HEDERA_HCS_TOPIC_ID`: create an HCS topic on Testnet, then copy its topic id (`0.0.x`).
- `HEDERA_SCHEDULE_ADMIN_KEY`: admin private key used to create/delete scheduled transactions (required to cancel auto-release in disputes).
- `HEDERA_SCHEDULE_ADMIN_KEY_TYPE`: optional key parser override for schedule admin key (`ecdsa`, `ed25519`, `auto`).
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
- `X402_FACILITATOR_MODE`: `verify-settle` (Blocky-compatible) or `legacy` (single custom funding endpoint).
- `X402_FACILITATOR_API_BASE_URL`: facilitator base URL for direct pay submission (`/api/orders/:id/pay/submit`).
- For Blocky testnet hosted API, use `https://api.testnet.blocky402.com` (no `/v1` suffix).
- `X402_FACILITATOR_VERIFY_PATH`: verification endpoint (default `/verify`).
- `X402_FACILITATOR_SETTLE_PATH`: settlement endpoint (default `/settle`).
- `X402_FACILITATOR_FUNDING_PATH`: legacy relative funding path when `X402_FACILITATOR_MODE=legacy`.
- `X402_FACILITATOR_API_KEY`: optional bearer token for facilitator API calls.
- `X402_FACILITATOR_API_KEY_HEADER`: API key header name (default `X-Api-Key`).
- `X402_FACILITATOR_TIMEOUT_MS`: timeout for facilitator HTTP calls.
- `X402_PAYMENT_NETWORK`: x402 network identifier (`hedera-testnet` for current hackathon flow).
- `X402_PAYMENT_RESOURCE_BASE_URL`: base URL used to build `paymentRequirements.resource`.
- `X402_PAYMENT_DESCRIPTION`: description included in x402 payment requirements.
- `X402_PAYMENT_MIME_TYPE`: MIME type included in x402 payment requirements.
- `X402_PAYMENT_MAX_TIMEOUT_SECONDS`: timeout embedded in x402 payment requirements.
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
- In `WORLD_ID_MODE=mock`, `demo:real-e2e` auto-rotates `nullifier_hash` at runtime to avoid replay collisions across repeated runs.

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
- `REAL_PAYER_ACCOUNT`

Recommended real-mode env:
- `WORLD_ID_MODE=live`
- `HEDERA_ENABLED=true`
- `X402_REQUIRE_SIGNED_WEBHOOK=true`
- `X402_VERIFY_HEDERA_TX=true`
- `X402_FACILITATOR_MODE=verify-settle`
- `X402_FACILITATOR_API_BASE_URL=https://api.testnet.blocky402.com`

Optional env for direct facilitator submit path:
- `REAL_X402_PAYMENT_HEADER`: base64 x402 payment header generated by the payer agent (used with `POST /api/orders/:id/pay/submit`).
- If `REAL_X402_PAYMENT_HEADER` is omitted, the script falls back to signed webhook funding and still requires `REAL_HEDERA_TX_ID`.

## 5. What the Script Covers
- Worker onboarding (`/api/world/verify` + `/api/workers`)
- Order creation
- x402-style payment requirement generation
- direct pay submission path for agents: `POST /api/orders/:id/pay/submit` (when `REAL_X402_PAYMENT_HEADER` is provided)
- signed funding confirmation webhook fallback (when direct submit payload is not provided)
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
