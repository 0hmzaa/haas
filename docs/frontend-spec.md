# HumanAsAService Frontend Specification (MVP)

## 1. Purpose
This document defines the frontend MVP for HumanAsAService, aligned with `doc.md` and `AGENTS.md`.

Frontend goals:
- Provide a clean operator UX for worker onboarding, booking, execution, dispute, and audit.
- Keep the product narrow: one worker per order, direct booking, no marketplace bidding complexity.
- Preserve API-first architecture: every workflow must remain executable by API clients/agents without the web UI.

## 2. Product Constraints
- Exactly one worker per order.
- Direct booking only.
- No bidding or multi-worker dispatch.
- Postgres is source of truth.
- HCS is audit timeline, not business clock.
- World ID remains integrated in the model; UI enforcement can be temporarily deferred.

## 3. Frontend Scope

### 3.1 In Scope
- Public product pages and worker directory.
- Worker wallet onboarding and profile management.
- Client/operator booking and order actions.
- Worker task execution and proof submission.
- Dispute and reviewer voting UX.
- Audit timeline UX with explorer links.
- Reputation/ranking display.

### 3.2 Out of Scope (for this phase)
- Advanced notification systems.
- Full geospatial matching (lat/lng proximity).
- Multi-language UI.
- Smart-contract style onchain UI controls.

## 4. Authentication and Identity

### 4.1 Worker Auth
- Wallet-first sign-in with HashPack (HashConnect).
- Persistent backend session (DB-backed), no email/password auth.

### 4.2 Client Access for AI Agents
- Agent clients use API-first integration (`ClientApp` + API key model).
- Human operator console can view and operate client orders.
- Web UI is an operator cockpit; agents can call API directly.

### 4.3 World ID Status
- World verification state exists in the UX and data model.
- Worker can be listed/bookable in temporary "pending verification" mode for MVP.
- Flag and UI path are prepared for strict enforcement later.

## 5. Information Architecture

## 5.1 Public Routes
- `/` product landing
- `/workers` worker directory
- `/workers/[id]` worker profile detail

## 5.2 App Routes
- `/app` role hub
- `/app/worker/onboarding`
- `/app/worker/profile`
- `/app/worker/tasks`
- `/app/worker/tasks/[id]`
- `/app/worker/reviews`
- `/app/worker/reviews/[orderId]`
- `/app/client/orders`
- `/app/client/orders/[id]`
- `/app/client/orders/[id]/pay`
- `/app/orders/[id]/audit`

## 6. Core User Flows

### 6.1 Worker Onboarding
1. Connect HashPack wallet.
2. Fill profile data (name, location, trade/skills, description, hourly/base rate).
3. Save profile.
4. Profile appears in worker directory.
5. World verification shown as pending (enforcement postponed).

### 6.2 Agent/Client Booking Flow
1. Agent queries workers by filters (location, price, reputation, availability).
2. Agent/operator creates order.
3. Payment requirements requested (`/pay`).
4. Funding executed:
   - Default: assisted/operator flow.
   - Advanced: direct submit (`/pay/submit`).
5. Order becomes `FUNDED`.

### 6.3 Worker Execution Flow
1. Worker starts funded order.
2. Worker uploads proof artifact(s).
3. Order enters review window.
4. Client/agent approves, disputes, or stays silent.
5. Silence for 72h triggers auto-release path.

### 6.4 Dispute/Review Flow
1. Client opens dispute.
2. Worker can respond.
3. 3 reviewers vote: `RELEASE_TO_WORKER`, `REFUND_CLIENT`, `SPLIT_PAYMENT`.
4. Resolution logic:
   - Majority vote wins.
   - If all 3 votes differ, resolve to `SPLIT_PAYMENT` (middle-ground rule).

## 7. API Contract Usage (Frontend)

### 7.1 Existing Endpoints to Consume
- `GET /api/workers`
- `GET /api/workers/:id`
- `POST /api/workers`
- `PATCH /api/workers/:id`
- `POST /api/world/verify`
- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/pay`
- `POST /api/orders/:id/pay/submit`
- `POST /api/orders/:id/start`
- `POST /api/orders/:id/proof`
- `GET /api/orders/:id/proof`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/dispute`
- `GET /api/orders/:id/dispute`
- `POST /api/orders/:id/dispute/respond`
- `POST /api/orders/:id/dispute/vote`
- `GET /api/orders/:id/audit`
- `GET /api/reputation/workers/:id`
- `GET /api/reputation/reviewers/:id`

### 7.2 Backend Additions Required for Better UX
- Auth endpoints for wallet challenge/session.
- Role-based order listing endpoints (worker/client/reviewer).
- Reviewer queue endpoint.
- Optional ratings summary endpoint for leaderboard cards.

## 8. UI Design Direction
- Theme: warm off-white + deep brown/near-black.
- Visual style: simple, square, minimal, high readability.
- No flashy gradients or dense effects.
- Strong hierarchy with clean cards/tables/status pills.
- Mobile-first responsive behavior.

Design tokens (initial):
- `--bg`: `#f7f3ec`
- `--surface`: `#fffdf8`
- `--text`: `#1f1a17`
- `--muted`: `#6d6258`
- `--primary`: `#2f221a`
- `--primary-contrast`: `#f7f3ec`
- `--border`: `#d8ccbd`
- `--success`: `#1f6b3b`
- `--warning`: `#8a5a17`
- `--danger`: `#8a1f1f`

## 9. State and Data Handling
- Use `fetch` only.
- Keep frontend state simple and explicit.
- Avoid hidden business rules in UI.
- Source business statuses from backend enums.
- Preserve optimistic updates only where low risk.

## 10. Reputation and Ranking
- Worker ranking shown as `/5` score and supporting metrics.
- MVP score display is outcome-based (approval/dispute/refund/split signals).
- Reviewer earnings and worker earnings surfaced in dashboard summaries.
- Reviewer payout reserve should derive from order-level `reviewerFeeReserve`.

## 11. Audit and Transparency UX
- Order detail includes explicit link to audit page.
- Audit page exposes:
  - lifecycle timeline
  - Hedera transaction ids
  - HCS topic references
  - explorer links (HashScan/Mirror)
- Include a compact "evidence pack" copy block for demo usage.

## 12. Delivery Plan (Commit Gates)
For each implementation milestone:
1. Implement isolated slice.
2. Run `pnpm lint`.
3. Run `pnpm build`.
4. Commit with conventional commit message.

## 13. Acceptance Criteria
- Worker can onboard with wallet and become listed.
- Client/operator can create and fund order.
- Worker can submit proof from task view.
- Client can approve/dispute from order view.
- Reviewer can vote on assigned disputes.
- Audit page provides explorer-verifiable evidence links.
- UI stays clean, coherent, and responsive on desktop/mobile.
