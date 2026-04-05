# AI Agent Integration Guide (Client-Side Orchestration)

This guide is meant to be handed to an AI coding/operator agent (for example, a fresh Codex instance) so it can drive HumanAsAService safely and consistently.

## 1. Scope and Non-Negotiables

HumanAsAService is not a marketplace. The agent must preserve these product rules:

- Exactly one worker per order.
- No bidding/open applications.
- No multi-worker dispatch.
- Postgres is the business source of truth.
- HCS is audit-only (compact events, no heavy payloads).
- x402 direct submit is the preferred payment path.

## 2. Base URL and Runtime Assumptions

- API base URL: `http://localhost:4000`
- Health check: `GET /api/health`
- Default content type: `application/json`
- No JWT auth layer in MVP, but ownership is enforced on critical actions.

## 3. Required Identity Rule for Client Flows

Always use a stable Hedera account as `clientAccountId` when creating an order.

Why:
- Approve and dispute actions enforce ownership against `clientAccountId`.
- If you change account identity mid-flow, you will get `403` on approve/dispute.

## 4. Preferred x402 Funding Flow (Direct Submit)

Use this exact sequence:

1. `POST /api/orders/:id/pay` to create/fetch payment requirements.
2. Read:
   - `payment.x402PaymentId`
   - `payment.x402.paymentRequirements`
3. Build a signed `paymentHeader` (x402 payload) with the payer key.
4. `POST /api/orders/:id/pay/submit` with:
   - `x402PaymentId`
   - `signedPayload: { "paymentHeader": "<base64>" }`
   - `payerAccount`
5. Expect `funded=true` and `status="FUNDED"`.
6. Confirm order becomes `FUNDED` using `GET /api/orders/:id`.

Important:
- Do not use `/api/webhooks/x402` from a client agent except explicit fallback testing.
- Direct submit is what you want for normal usage and Blocky visibility.

## 5. Endpoints the Agent Should Use

### Worker discovery

- `GET /api/workers`
- `GET /api/workers/:id`

### Order lifecycle

- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/pay`
- `POST /api/orders/:id/pay/submit`
- `POST /api/orders/:id/start`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/dispute`
- `GET /api/orders/:id/dispute`
- `GET /api/orders/:id/audit`

### Proof (normally worker-side)

- `POST /api/orders/:id/proof` (multipart upload)
- `GET /api/orders/:id/proof`

## 6. Minimal Client Agent Workflow

1. Find worker:
   - `GET /api/workers?country=...&city=...&skill=...&minRating=...`
2. Create order:
   - `POST /api/orders` with `clientId`, `clientAccountId`, `workerId`, `title`, `objective`, `instructions`, `amount`, `currency`.
3. Fund order:
   - `POST /api/orders/:id/pay`
   - create `paymentHeader`
   - `POST /api/orders/:id/pay/submit`
4. Start order:
   - `POST /api/orders/:id/start`
5. Wait for proof:
   - poll `GET /api/orders/:id` until `PROOF_SUBMITTED` / `REVIEW_WINDOW`.
6. Resolve:
   - Approve: `POST /api/orders/:id/approve` with `actorId` and `clientAccountId`
   - Or dispute: `POST /api/orders/:id/dispute` with `reasonCode`, `clientStatement`, optional `actorId`, and `clientAccountId`.
7. Audit:
   - `GET /api/orders/:id/audit`

## 7. Payload Examples

### Create order

```json
{
  "clientId": "client-live",
  "clientAccountId": "0.0.8507969",
  "workerId": "worker_id_here",
  "title": "Local task",
  "objective": "Perform a real-world action",
  "instructions": "Detailed execution steps",
  "amount": "1.00",
  "currency": "HBAR"
}
```

### Submit direct x402 payment

```json
{
  "x402PaymentId": "uuid-from-pay-endpoint",
  "signedPayload": {
    "paymentHeader": "base64-x402-payment-header"
  },
  "payerAccount": "0.0.8507969"
}
```

### Approve

```json
{
  "actorId": "client-live",
  "clientAccountId": "0.0.8507969"
}
```

### Open dispute

```json
{
  "reasonCode": "PROOF_INSUFFICIENT",
  "clientStatement": "Submitted proof does not satisfy acceptance criteria.",
  "actorId": "client-live",
  "clientAccountId": "0.0.8507969"
}
```

## 8. Error Handling Rules

- `400`: malformed payload or missing field.
- `403`: ownership mismatch (wrong `clientAccountId`/actor).
- `404`: unknown order/funding/dispute.
- `409`: invalid state transition, payment mismatch, or id mismatch.
- `502`: facilitator/network/upstream issue.

Agent behavior:
- Never continue blindly after 4xx/5xx.
- Re-fetch order state after each critical step.
- Treat `409` as business-state conflict and reconcile before retry.

## 9. x402 Header Generation (Local Helper)

If you have payer private key and payment requirements JSON:

```bash
pnpm --filter api exec node scripts/generate-x402-hedera-payment-header.mjs \
  --requirements-file /tmp/haas-payment-requirements-<orderId>.json \
  --payer-account 0.0.x \
  --payer-private-key 0x...
```

Prerequisite:
- API env must include `X402_PAYMENT_FEE_PAYER` for Hedera direct submit requirements.

## 10. Proof and Demo Evidence Checklist

For each run, store:

- `orderId`
- `x402PaymentId`
- `hederaTxId` from funding
- HashScan tx URL
- HashScan topic URL
- `/api/orders/:id/audit` snapshot
- final `order.status`

## 11. Copy/Paste Prompt for a Fresh Codex Instance

```text
You are operating HumanAsAService as a client orchestration agent.
Follow docs/ai-agent-integration-guide.md strictly.
Use API base http://localhost:4000.
Always keep one stable clientAccountId per order and send it again for approve/dispute.
Use direct x402 funding path: POST /api/orders/:id/pay then POST /api/orders/:id/pay/submit with signedPayload.paymentHeader and payerAccount.
Do not use /api/webhooks/x402 unless explicitly asked for fallback testing.
After every lifecycle action, re-fetch GET /api/orders/:id and stop on any 4xx/5xx until reconciled.
Return proof artifacts (orderId, x402PaymentId, hederaTxId, HashScan URL, audit snapshot).
```

