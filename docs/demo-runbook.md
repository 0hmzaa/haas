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

## 2. Secret Retrieval Guide (FR)

### Hedera (Testnet)
- `HEDERA_OPERATOR_ACCOUNT_ID`: récupère l’`Account ID` de ton compte opérateur Testnet (format `0.0.x`) dans ton wallet/portal Hedera.
- `HEDERA_OPERATOR_PRIVATE_KEY`: récupère la clé privée associée à ce compte (ne jamais la commiter).
- `HEDERA_ESCROW_ACCOUNT_ID`: compte Hedera receveur des fonds lockés (au MVP, peut être le même que l’opérateur).
- `HEDERA_HCS_TOPIC_ID`: crée un topic HCS sur Testnet, puis copie son id (`0.0.x`).
- `HEDERA_SCHEDULE_ADMIN_KEY`: clé admin utilisée pour créer/supprimer les scheduled tx (obligatoire pour annuler l’auto-release en cas de dispute).
- `HEDERA_MIRROR_NODE_BASE_URL`: optionnel, laisser vide pour utiliser la valeur par défaut testnet.

### World ID (live)
- `WORLD_ID_MODE=live`
- `WORLD_ID_APP_ID`: créé dans le dashboard World pour ton app.
- `WORLD_ID_API_KEY`: clé backend de vérification associée à l’app.
- `WORLD_ID_VERIFY_URL`: soit l’URL fournie par World, soit dérivée de l’`APP_ID` selon leur endpoint de verify.
- `WORLD_VERIFY_PAYLOAD_FILE`: fichier JSON local contenant `session_id`, `nullifier_hash`, `proof`, et optionnel `walletAddress`.

Exemple minimal de payload World (`world-verify-payload.json`):

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
- `X402_FACILITATOR_ID`: identifiant du facilitateur utilisé pour signer et soumettre le funding.
- `X402_FACILITATOR_SIGNING_SECRET`: secret partagé pour la signature HMAC du webhook x402.
- `X402_REQUIRE_SIGNED_WEBHOOK=true`
- `X402_VERIFY_HEDERA_TX=true` recommandé en réel.
- `X402_MIRROR_NODE_BASE_URL`: optionnel, sinon fallback vers mirror Hedera config.

### Valeurs de run E2E réel
- `REAL_HEDERA_TX_ID`: tx id Hedera réel du funding (issu du flow facilitateur).
- `REAL_PAYER_ACCOUNT`: compte payeur Hedera réel (format `0.0.x`).
- `REAL_ORDER_AMOUNT`, `REAL_ORDER_CURRENCY`, `REAL_CLIENT_ID`: paramètres de scénario.

### Checklist avant run réel
- `.env` rempli et non versionné.
- API démarrée avec ces vars.
- Worker créé avec `walletAddress` Hedera valide (`0.0.x`).
- `WORLD_VERIFY_PAYLOAD_FILE` pointe vers un fichier existant.

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
