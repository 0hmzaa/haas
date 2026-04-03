AGENTS.txt

Project
HumanAsAService.xyz

HumanAsAService is a lightweight AI-native platform and API that lets an AI agent, model, or software system book exactly one verified human at a time for one clearly scoped real-world task.

This is NOT:
- a bounty marketplace
- a freelancer marketplace clone
- a multi-worker dispatch system
- a generic labor platform

This IS:
- a verified human execution layer for AI systems
- a proof-based task completion system
- an API-first workflow for agents
- a Hedera-native settlement flow without Solidity

==================================================
CORE PRODUCT IDEA
==================================================

AI systems can reason and plan, but they still fail when a task needs:
- physical presence
- local context
- human judgment
- real-world verification
- real-world execution

HumanAsAService turns a human into a bookable execution primitive.

Main loop:
1. find one verified human
2. book that human for one task
3. lock payment
4. receive proof
5. approve, dispute, or auto-release after timeout
6. update reputation

==================================================
LOCKED TECHNICAL CHOICES
==================================================

- Chain: Hedera
- Network: Hedera Testnet
- No Solidity: yes
- Identity: World ID 4.0
- Payment interface for agents: x402-compatible flow
- x402 execution model: facilitator-compatible Hedera flow
- Native Hedera services used:
  - HCS
  - Scheduled Transactions
  - Mirror Node
  - account-based transfers
- Frontend: Next.js + TypeScript
- Backend: Express + TypeScript
- HTTP client: fetch
- Database: PostgreSQL
- ORM: Prisma
- Infra: Docker Compose
- Proof storage for MVP: local Docker volume
- No IPFS
- No S3 for MVP

==================================================
PRODUCT CONSTRAINTS
==================================================

- exactly one worker per order
- direct booking only
- no bidding
- no open applications
- no multi-worker jobs
- no marketplace-style complexity
- no tokenomics
- no DAO
- no smart contracts for escrow
- no over-engineering

==================================================
ROLES
==================================================

Client
Entity requesting the task.
Can be:
- human
- operator
- company
- AI agent
- autonomous software system

Worker
Verified human who executes the task.

Reviewer
Verified human who reviews disputes.
Only used when a dispute happens.

Platform
Coordinates identity, booking, proof, settlement, disputes, and reputation.

==================================================
WORLD ID MODEL
==================================================

World ID is used to ensure:
- proof of human
- uniqueness
- durable identity continuity inside the app

Important implementation rule:
- nullifier = uniqueness / replay protection
- session_id = durable continuity across requests

Do NOT use nullifier as the permanent worker identity.

The backend should create an internal verifiedHumanId linked to World-verified state.

Workers and reviewers must be World-verified.

==================================================
HEDERA MODEL
==================================================

This project uses a native-service orchestration pattern, not a Solidity escrow.

Meaning:
- business logic lives in backend + database
- funds are held through platform-managed Hedera account flows
- audit trail is written to HCS
- delayed release uses Scheduled Transactions
- Mirror Node is used for reading and reconciliation

Important terminology:
This is an application-managed escrow-like flow, not a fully trustless smart contract escrow.

That is acceptable and intentional for this MVP.

==================================================
x402 MODEL
==================================================

x402 is the agent-facing payment interface.

Meaning:
- agents pay programmatically through HTTP
- backend returns payment requirements
- payment goes through a facilitator-compatible Hedera flow
- backend marks the order as funded after confirmation

Conceptual distinction:
- x402 = how an agent pays
- Hedera = how payment, audit, and release are settled

==================================================
MAIN WORKFLOW
==================================================

1. Worker onboarding
1. connect wallet
2. complete World ID verification
3. backend verifies proof
4. backend creates internal verified identity
5. worker fills profile
6. worker becomes bookable

2. Order booking
1. client/agent searches workers
2. client opens worker profile
3. client creates order
4. backend computes payment structure
5. client/agent funds the order
6. backend confirms funding
7. order becomes FUNDED

3. Task execution
1. worker receives task
2. worker performs task
3. worker uploads proof
4. backend stores proof locally
5. backend stores proof metadata in Postgres
6. backend hashes proof metadata/references
7. backend writes proof event to HCS
8. review window starts

4. Review
Client can:
- approve
- dispute
- stay silent

If approved:
- payout executes

If disputed:
- scheduled payout is cancelled
- review flow begins

If silent for 72h:
- auto-release executes

5. Dispute
1. client disputes
2. worker can respond
3. 3 reviewers are assigned
4. reviewers inspect task + proof + dispute reason
5. reviewers vote:
   - RELEASE_TO_WORKER
   - REFUND_CLIENT
   - SPLIT_PAYMENT
6. majority decides outcome
7. settlement executes
8. reputation updates

==================================================
SCHEDULED TRANSACTION RULE
==================================================

This is critical:

Do NOT create timeout schedules without an admin key.

Reason:
- without an admin key, the schedule cannot be deleted
- if a dispute happens before expiry, the payout must be cancellable

Required rule:
- every auto-release schedule must be created with an admin key controlled by the platform

==================================================
TIMEOUT SOURCE OF TRUTH
==================================================

The source of truth for the 72-hour review window is:

- PostgreSQL field: proofSubmittedAt

Use this field for:
- UI countdown
- backend checks
- schedule timing
- dispute timing

HCS is the audit trail, not the business clock.

==================================================
HCS USAGE
==================================================

HCS is the ordered audit layer.

Use it for compact lifecycle events only.

Recommended HCS events:
- order.created
- order.funded
- order.started
- proof.submitted
- review.window.started
- order.approved
- order.disputed
- reviewer.vote.submitted
- order.resolved
- order.auto_released
- order.refunded

Store in HCS only compact messages.
Examples:
- eventType
- orderId
- actorId
- timestamp
- proofHash
- storageRef
- resolution
- txId
- nonce

Do NOT store raw proof files or large payloads in HCS.

==================================================
MIRROR NODE USAGE
==================================================

Mirror Node is used for:
- transaction lookup
- HCS indexing
- audit timelines
- reconciliation
- debugging
- optional public transparency views

==================================================
PROOF STORAGE MODEL
==================================================

For MVP:
- proof files are stored locally on disk
- local path is mounted as Docker volume
- metadata is stored in PostgreSQL via Prisma

Recommended path pattern:
 /storage/proofs/{orderId}/{filename}

Suggested proof metadata:
- orderId
- originalName
- mimeType
- localPath
- fileSize
- sha256Hash
- uploadedAt

No IPFS.

==================================================
REPUTATION MODEL
==================================================

Reputation is required.

World ID gives uniqueness.
Reputation gives that uniqueness economic meaning.

Worker reputation inputs:
- completed jobs
- approval rate
- dispute rate
- dispute loss rate
- proof quality score
- on-time completion rate
- client ratings
- reviewer-confirmed quality

Reviewer reputation inputs:
- number of reviews completed
- alignment with majority
- review speed
- abuse reports
- consistency

Suggested worker profile trust display:
- verified human badge
- completed jobs
- average rating
- approval rate
- dispute rate
- reviewer badge if eligible

Reviewer eligibility:
- World verified
- high reputation
- enough completed jobs
- low dispute loss rate
- not suspended
- not involved in the case

==================================================
API SHAPE
==================================================

Suggested endpoints:

GET    /api/workers
GET    /api/workers/:id
POST   /api/orders
GET    /api/orders/:id
POST   /api/orders/:id/pay
POST   /api/orders/:id/start
POST   /api/orders/:id/proof
GET    /api/orders/:id/proof
POST   /api/orders/:id/approve
POST   /api/orders/:id/dispute
GET    /api/orders/:id/dispute
GET    /api/reputation/workers/:id
GET    /api/reputation/reviewers/:id
POST   /api/world/verify
POST   /api/webhooks/x402
POST   /api/webhooks/hedera

Suggested order states:

DRAFT
PAYMENT_PENDING
FUNDED
IN_PROGRESS
PROOF_SUBMITTED
REVIEW_WINDOW
APPROVED
DISPUTED
AUTO_RELEASED
REFUNDED
SPLIT_SETTLED
CANCELLED
FAILED

==================================================
x402 + HEDERA FUNDING FLOW
==================================================

This is the required logic:

1. agent calls POST /api/orders/:id/pay
2. API returns x402-style payment requirements
3. agent signs payment payload
4. payload is processed through facilitator-compatible flow
5. facilitator verifies and submits Hedera transaction
6. backend receives successful funding confirmation
7. backend stores funding metadata in Postgres:
   - orderId
   - x402PaymentId
   - hederaTxId
   - facilitatorId
   - payerAccount
   - amount
   - asset
   - status
   - fundedAt
8. backend sets order state to FUNDED
9. backend writes compact order.funded event to HCS

If payment fails:
- order stays PAYMENT_PENDING
- no HCS funded event
- no worker execution starts

==================================================
SUGGESTED STACK
==================================================

Frontend:
- Next.js
- React
- TypeScript

Backend:
- Express
- Node.js
- TypeScript

Database:
- PostgreSQL
- Prisma

Infra:
- Docker Compose

Hedera:
- @hashgraph/sdk
- HCS
- Scheduled Transactions
- Mirror Node REST

Validation / typing:
- TypeScript first
- shared types and schemas across web + api

HTTP:
- use fetch, not axios

==================================================
SUGGESTED REPOSITORY STRUCTURE
==================================================

human-as-a-service/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ shared/
│  ├─ config/
│  └─ hedera/
├─ docs/
├─ docker/
├─ storage/
│  └─ proofs/
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md

Meaning:
- apps/web = Next.js frontend
- apps/api = Express backend
- packages/shared = shared types/schemas/utils
- packages/config = shared env/config
- packages/hedera = reusable Hedera helpers
- docs = project memory
- docker = local infra
- storage/proofs = local proof files

==================================================
BUILD PRIORITIES
==================================================

Priority 1
- monorepo setup
- Next.js shell
- Express shell
- Prisma + Postgres
- Docker Compose
- local proof volume

Priority 2
- worker onboarding
- World ID verification
- worker profile CRUD
- worker search

Priority 3
- order creation
- order state machine
- x402-compatible pay endpoint
- facilitator-compatible verification
- Hedera funding flow
- HCS event writing

Priority 4
- proof upload
- review window
- scheduled timeout release
- approval path
- schedule deletion path

Priority 5
- disputes
- reviewer voting
- reputation updates
- mirror reconciliation

==================================================
NON-GOALS
==================================================

Do NOT build:
- multi-worker flows
- complex marketplace logic
- Solidity escrow
- tokenomics
- governance
- IPFS
- overcomplicated chat systems
- unnecessary abstractions too early

==================================================
IMPORTANT IMPLEMENTATION RULES
==================================================

- keep the MVP simple
- one worker only
- one order only
- one proof flow
- one dispute flow
- use fetch
- no Solidity
- no IPFS
- do not treat HCS as storage
- do not create schedules without admin key
- do not use World nullifier as worker identity
- Postgres is the business source of truth
- HCS is the audit trail
- optimize for a clean hackathon demo and strong developer experience

==================================================
ONE-SENTENCE SUMMARY
==================================================

HumanAsAService is a World ID + Hedera + x402 platform where AI agents can hire one verified human for one real-world task, receive structured proof, and settle payment through approval, timeout, or reviewer-based dispute resolution.