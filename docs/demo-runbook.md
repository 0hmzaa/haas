# HumanAsAService Demo Runbook

## 1. Prerequisites
- Start PostgreSQL and app services (for example via Docker Compose).
- Ensure API is reachable on `http://localhost:4000`.
- Set `HEDERA_SCHEDULE_ADMIN_KEY` in environment (required for review timeout schedules).
- If `HEDERA_ENABLED=true`, configure operator/topic envs and ensure workers are onboarded with Hedera-style `walletAddress` (format `0.0.x`).
- For World ID, keep `WORLD_ID_MODE=mock` for local demo, or switch to `WORLD_ID_MODE=live` with `WORLD_ID_VERIFY_URL`/`WORLD_ID_APP_ID`.
- x402 webhooks are signed by default; align API + demo script with the same `X402_FACILITATOR_ID` and `X402_FACILITATOR_SIGNING_SECRET`.
- Optional strict mode: set `X402_VERIFY_HEDERA_TX=true` to require Mirror Node confirmation of `hederaTxId` for successful funding webhooks.

## 2. Quality Gate Before Demo
Run:

```bash
pnpm lint
pnpm build
```

## 3. Execute Demo Script
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

## 4. What the Script Covers
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

## 5. Manual Checks
- `GET /api/orders/:id` to verify final status.
- `GET /api/orders/:id/audit` to inspect lifecycle chronology.
- `GET /api/reputation/workers/:id` and `GET /api/reputation/reviewers/:id` to inspect score updates.
