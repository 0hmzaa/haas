HumanAsAService.xyz
Complete Project Context for LLMs, Builders, and MVP Implementation

==================================================
1. PROJECT DEFINITION
==================================================

HumanAsAService.xyz is a lightweight AI-native platform and API that allows an AI agent, model, or software system to rent exactly one verified human at a time for a clearly scoped task.

This project is intentionally narrow.

It is:
- a verified human execution layer for AI systems
- a direct-booking system
- a proof-based task completion system
- an agent-friendly payment and settlement workflow

It is NOT:
- a freelancer marketplace clone
- a bounty board
- a multi-worker dispatch platform
- a generic labor marketplace

Core wedge:
Book one verified human for one task, lock payment, receive proof, and settle safely.

==================================================
2. LOCKED IMPLEMENTATION CHOICES
==================================================

These implementation choices are fixed:

- Human verification: World ID 4.0
- Chain: Hedera
- Network for MVP / hackathon: Hedera Testnet
- No Solidity: yes
- Payment interface for agents: x402-compatible flow on Hedera
- x402 settlement pattern: facilitator-based flow compatible with Hedera
- Native Hedera services used:
  - Hedera Consensus Service (HCS)
  - Scheduled Transactions
  - Mirror Node
  - account-based transfers
- Backend language: TypeScript
- Backend framework: Express
- Frontend: Next.js
- API style: REST
- HTTP client preference: fetch
- Database: PostgreSQL
- ORM: Prisma
- Local dev infra: Docker Compose
- Proof storage for MVP: local Docker volume managed by the API
- No IPFS for MVP
- Goal:
  - build a strong MVP aligned with Hedera and World requirements
  - keep architecture simple enough for a hackathon
  - make the product understandable by humans and code-generation LLMs

==================================================
3. CORE THESIS
==================================================

AI systems are strong at:
- reasoning
- planning
- summarization
- orchestration
- digital automation

But they still fail when a task requires:
- physical presence
- local context
- real-world verification
- human judgment
- human action
- trustable proof of execution

HumanAsAService turns a real person into a bookable execution primitive for AI systems.

The platform lets an AI agent:
1. discover a human
2. verify that the human is unique and trusted
3. reserve that human for one task
4. lock payment
5. receive structured proof
6. approve, dispute, or wait for timeout settlement
7. rely on reputation for future selection

==================================================
4. PRODUCT PHILOSOPHY
==================================================

4.1 What we keep
We keep only the strongest primitives:
- verified human onboarding
- worker discovery
- direct booking of a single worker
- proof submission
- escrow-like settlement
- timeout release
- dispute resolution
- reputation
- API-first agent access

4.2 What we remove
We deliberately remove complexity:
- no bounty marketplace
- no worker bidding
- no multi-worker jobs
- no dispatching many workers
- no “hire a team” logic
- no social or companionship use cases
- no marketplace-heavy UX

4.3 Desired product feeling
The product should feel like:
- a trust layer between AI and humans
- a transactional protocol for real-world execution
- an API-first system for agents

It should not feel like Upwork or Fiverr.

==================================================
5. HIGH-LEVEL SYSTEM STATEMENT
==================================================

HumanAsAService is a platform where:
- workers are verified humans through World ID 4.0
- clients or AI agents can reserve one worker for one task
- funds are held in a Hedera-native escrow-like flow without Solidity
- proof is stored offchain and anchored through Hedera-native audit events
- disputes are resolved by 3 verified human reviewers
- reputation accumulates over time
- agents can pay through an x402-compatible API flow
- x402 payments are verified and settled through a facilitator pattern compatible with Hedera

==================================================
6. WHY WORLD ID 4.0 IS CORE
==================================================

World ID is not just a badge.
It is the foundation of trust for workers and reviewers.

This system needs:
- proof that a participant is a real human
- proof that a participant is unique in the platform trust model
- continuity of identity for reputation, sanctions, and reviewer eligibility

6.1 How World ID is used

A. Worker onboarding
A person must complete World ID verification before becoming eligible to:
- create a worker profile
- receive bookings
- submit work
- become a reviewer later

B. Reviewer eligibility
A reviewer must also be:
- a verified human
- an internal high-reputation participant
- not involved in the case being reviewed

C. Durable internal identity
The platform creates an internal identity derived from verified World-backed account state.
This internal identity is used for:
- reputation
- dispute history
- sanctions
- bans
- reviewer eligibility
- worker trust score

6.2 Correct World ID 4.0 backend model
The backend must treat:
- nullifier as one-time-use uniqueness protection
- session_id as the stable continuity link across requests

This means:
- do not use nullifier as the permanent worker identity
- do store used nullifiers for replay / uniqueness protection
- do store session_id to maintain durable identity continuity

6.3 Important clarification
The platform does not need a public civil identity.
It only needs:
- proof-of-human
- uniqueness
- continuity inside the application

6.4 Product implication
A worker is not disposable or infinitely replaceable.
A worker becomes a durable, accountable verified human inside the protocol.

==================================================
7. WHY HEDERA IS THE CHOSEN CHAIN
==================================================

Hedera is chosen because the project fits better as a native-services orchestration system than as a Solidity smart-contract-first application.

The build uses:
- Hedera Consensus Service (HCS) for ordered audit messages
- Scheduled Transactions for timeout-based release flow
- Mirror Node for indexing and audit visibility
- account-based transfers for settlement logic
- no Solidity contracts

This gives the project:
- good fit for the Hedera prize tracks
- easier hackathon execution
- simpler architecture
- native auditability
- machine-friendly settlement flow

==================================================
8. WHY x402 IS USED
==================================================

x402 is used as the agent-facing payment interface.

Important distinction:
- x402 = how an agent pays for access / booking through HTTP
- Hedera = how settlement, audit, and payout logic are executed

This means x402 is the payment entry layer for agents, not the final trust layer itself.

8.1 Practical interpretation
An agent should be able to:
- call an endpoint to reserve a worker
- receive payment requirements
- pay programmatically
- get access to the funded order flow

8.2 Important implementation clarification
The implementation assumes:
- a facilitator pattern compatible with Hedera
- the client signs a payment payload
- the facilitator verifies it
- the facilitator adds the needed signature / fee handling
- the facilitator submits the transaction on-chain
- the backend receives confirmation and moves the order to FUNDED

8.3 Why this matters
This is the cleanest way to make x402 work with Hedera in an agent-native way while keeping the app architecture understandable.

==================================================
9. MAIN ROLES
==================================================

9.1 Client
The client is the requester of the task.
It can be:
- a human
- a company
- an operator
- an AI agent
- an autonomous software system

9.2 Worker
The worker is the human who executes the task.
A worker must be World-verified.

9.3 Reviewer
A reviewer is a verified human chosen to review disputes.
A reviewer is not the assigned worker.
Reviewers are selected only if a dispute occurs.

9.4 Platform
The platform coordinates:
- discovery
- booking
- proof intake
- timeout logic
- dispute review
- reputation
- settlement

9.5 Agent
The AI agent is a first-class client.
It can search, reserve, pay, and react to order lifecycle events.

==================================================
10. CORE PRODUCT OBJECTS
==================================================

10.1 WorkerProfile
Suggested fields:
- id
- verifiedHumanId
- walletAddress
- worldVerified
- displayName
- bio
- country
- city
- timezone
- languages
- skills
- availabilityStatus
- baseRate
- acceptedProofTypes
- ratingAvg
- completedJobs
- approvalRate
- disputeRate
- reputationScore
- reviewerEligible
- isSuspended
- isBanned

10.2 Order
Suggested fields:
- id
- clientId
- workerId
- title
- objective
- instructions
- locationContext
- deadlineAt
- expectedDurationMinutes
- requiredProofSchema
- acceptanceCriteria
- amount
- currency
- platformFeeBps
- reviewerFeeReserve
- reviewWindowHours
- status

10.3 ProofPackage
Suggested fields:
- id
- orderId
- workerId
- submittedAt
- summary
- checklistJson
- structuredJson
- attachments
- filePaths
- hashes
- geoMetadata
- timeMetadata
- confidenceStatement

10.4 DisputeCase
Suggested fields:
- id
- orderId
- reasonCode
- clientStatement
- workerStatement
- assignedReviewerIds
- votes
- resolution
- resolvedAt

10.5 ReputationRecord
Suggested fields:
- id
- workerId
- orderId
- rating
- approved
- timely
- disputed
- disputeOutcome
- proofQualityScore
- reviewerFeedback
- deltaScore

10.6 HederaOrderLedger
Suggested fields:
- orderId
- hederaNetwork
- escrowAccountId
- scheduleId
- topicId
- fundingTxId
- proofMessageSequence
- disputeMessageSequence
- releaseTxId
- refundTxId
- x402PaymentId
- facilitatorId
- payerAccount
- asset
- fundedAt

==================================================
11. PRODUCT SCOPE
==================================================

11.1 In scope for MVP
- World ID onboarding
- worker profiles
- direct booking of one worker
- x402-compatible agent payment flow
- Hedera-native escrow-like fund holding
- proof submission
- client approval
- auto-release after 72 hours
- dispute flow
- 3-reviewer adjudication
- worker reputation
- reviewer reputation
- mirror-indexed audit history
- TypeScript REST API
- Next.js frontend
- Prisma + PostgreSQL
- Docker Compose local development
- proof files stored in a local Docker volume

11.2 Out of scope for MVP
- multi-worker bookings
- bounties
- bidding
- open applications
- staking/slashing tokenomics
- DAO governance
- subscriptions
- mobile app
- trustless Solidity escrow
- cross-chain settlement
- IPFS

==================================================
12. MAIN WORKFLOW
==================================================

12.1 Worker onboarding
1. Worker opens the app
2. Worker connects wallet
3. Worker completes World ID verification
4. Backend verifies proof
5. Backend creates internal verified identity
6. Worker fills profile
7. Worker becomes bookable

12.2 Client / agent booking
1. Client searches workers
2. Client opens worker profile
3. Client creates task
4. Platform computes:
   - worker amount
   - platform fee
   - reviewer reserve if used
5. Client or agent funds booking
6. Platform moves funds into Hedera settlement flow
7. Order becomes active

12.3 Worker execution
1. Worker receives task
2. Worker performs task
3. Worker submits proof
4. Backend stores proof files on local storage volume
5. Backend stores proof metadata in PostgreSQL
6. Backend hashes proof references / metadata
7. Backend writes proof event to HCS
8. Review window starts

12.4 Client review
The client can:
- approve
- dispute
- stay silent

Approve:
- immediate settlement path executes

Dispute:
- payout freezes
- dispute review begins

Stay silent:
- after 72 hours, timeout release executes

12.5 Dispute resolution
1. Client disputes
2. Worker can respond
3. 3 reviewers are selected
4. Reviewers inspect:
   - task instructions
   - acceptance criteria
   - proof
   - dispute reason
   - worker response
5. Each reviewer votes:
   - RELEASE_TO_WORKER
   - REFUND_CLIENT
   - SPLIT_PAYMENT
6. Majority decides outcome
7. Settlement executes
8. Reputation updates

==================================================
13. HEDERA SETTLEMENT MODEL WITHOUT SOLIDITY
==================================================

This project does not use Solidity escrow contracts.

Instead it uses a native escrow-like orchestration pattern:
- funds are held under platform-controlled Hedera accounts
- order state is kept offchain
- key lifecycle events are written to HCS
- release timing uses Scheduled Transactions
- settlement is executed through account-based transfers
- Mirror Node is used for audit and reconciliation

13.1 Honest terminology
For the MVP, this is an application-managed escrow flow, not a fully trustless smart contract escrow.
That is acceptable for this build because:
- the project explicitly targets the no-Solidity path
- the focus is on native Hedera services
- the product still shows clear payment custody and settlement logic

13.2 Booking / funding flow
At booking time:
1. order is created offchain
2. payment is requested through x402-compatible flow
3. the client signs the x402 payment payload
4. the payload is checked by the facilitator
5. the facilitator finalizes and submits the Hedera transaction
6. the backend receives payment confirmation
7. backend stores funding metadata in PostgreSQL
8. funds are placed into an escrow-holding account
9. HCS logs order.funded
10. order state moves to FUNDED

13.3 Proof submission flow
After work is completed:
1. proof is uploaded offchain
2. proof metadata is hashed
3. HCS logs proof.submitted
4. review window starts
5. a timeout settlement path is created

13.4 Timeout release flow
After proof submission:
1. backend records proofSubmittedAt in PostgreSQL
2. backend creates a Scheduled Transaction for payout at T + 72h
3. the schedule must be created with an admin key
4. if client approves before deadline:
   - immediate payout executes
   - the scheduled payout is deleted or marked obsolete
5. if client disputes:
   - the scheduled payout is deleted
   - the dispute path begins
6. if client is silent:
   - the scheduled payout becomes the auto-release path

13.5 Why admin key matters
A Hedera Scheduled Transaction is immutable if it was created without an admin key.
Therefore:
- every auto-release schedule in this project must be created with an admin key
- the platform controls that key
- that key is used to delete the scheduled payout if approval or dispute happens before expiry

13.6 Source of truth for timeout
The source of truth for the 72-hour window is:
- PostgreSQL field: proofSubmittedAt

This field drives:
- UI countdown
- reviewer eligibility timing
- backend checks
- scheduled payout creation timing

HCS is the audit layer, not the primary business clock.

==================================================
14. HOW HCS IS USED
==================================================

HCS is used as the ordered audit layer of the platform.

14.1 Why HCS matters
HCS provides:
- ordered messages
- consensus timestamps
- tamper-evident chronology
- clean auditability for disputes and payouts

14.2 Recommended HCS events
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

14.3 What should be stored in HCS
Compact structured messages only:
- eventType
- orderId
- actorId
- timestamp
- proofHash
- storageRef
- resolution
- txId
- nonce

Do not store large media in HCS.

14.4 Important size rule
Keep HCS messages compact.
Do not treat HCS like a document store.
Proof artifacts remain offchain.

==================================================
15. MIRROR NODE USAGE
==================================================

Mirror Node is used for:
- transaction lookup
- HCS message indexing
- activity timelines
- settlement verification
- backend reconciliation
- optional public audit views

==================================================
16. REPUTATION SYSTEM
==================================================

Reputation is required.

World ID gives uniqueness.
Reputation gives meaning to that uniqueness.

16.1 Worker reputation inputs
Worker reputation should depend on:
- completed jobs
- approval rate
- dispute rate
- dispute loss rate
- proof quality score
- on-time completion rate
- client ratings
- reviewer-confirmed quality

16.2 Reviewer reputation inputs
Reviewer reputation should depend on:
- number of reviews completed
- alignment with majority
- review speed
- abuse reports
- consistency score

16.3 Suggested worker score
Use a bounded score, for example 0–100.

Positive inputs:
- completed orders
- high approval rate
- strong proof quality
- high average rating
- good timeliness

Negative inputs:
- frequent disputes
- dispute losses
- missed deadlines
- moderation penalties

16.4 Displayed profile trust
The UI should show:
- verified human badge
- completed jobs
- average rating
- approval rate
- dispute rate
- reviewer badge if eligible

16.5 Reviewer eligibility
A worker becomes reviewer-eligible only if:
- World verified = true
- completed jobs >= threshold
- approval rate >= threshold
- dispute loss rate <= threshold
- not suspended
- high enough trust score

==================================================
17. SAFETY / POLICY LAYER
==================================================

The platform must not allow arbitrary real-world tasks.

17.1 Disallowed or high-risk task examples
- illegal activity
- harassment
- coercion
- impersonation
- unsafe surveillance
- dangerous physical work
- regulated work requiring licenses
- exploitative or intimate services

17.2 Policy engine outputs
Before a booking, classify the task as:
- allowed
- allowed with warning
- manual review required
- rejected

==================================================
18. API MODEL
==================================================

The product is both:
- a web app
- an API for agents

18.1 Core agent actions
An agent should be able to:
- list workers
- get worker profile
- create order
- fund order
- fetch status
- retrieve proof
- approve
- dispute
- read dispute outcome

18.2 Suggested endpoints
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

18.3 Suggested webhooks
- order.created
- order.funded
- order.started
- proof.submitted
- review.window.started
- order.approved
- order.disputed
- dispute.resolved
- order.auto_released
- order.refunded

==================================================
19. ORDER STATE MACHINE
==================================================

Suggested states:
- DRAFT
- PAYMENT_PENDING
- FUNDED
- IN_PROGRESS
- PROOF_SUBMITTED
- REVIEW_WINDOW
- APPROVED
- DISPUTED
- AUTO_RELEASED
- REFUNDED
- SPLIT_SETTLED
- CANCELLED
- FAILED

Suggested transitions:
- DRAFT -> PAYMENT_PENDING
- PAYMENT_PENDING -> FUNDED
- FUNDED -> IN_PROGRESS
- IN_PROGRESS -> PROOF_SUBMITTED
- PROOF_SUBMITTED -> REVIEW_WINDOW
- REVIEW_WINDOW -> APPROVED
- REVIEW_WINDOW -> DISPUTED
- REVIEW_WINDOW -> AUTO_RELEASED
- DISPUTED -> REFUNDED
- DISPUTED -> SPLIT_SETTLED
- DISPUTED -> APPROVED

==================================================
20. TECHNICAL ARCHITECTURE
==================================================

20.1 Chosen stack

Frontend:
- Next.js
- TypeScript
- React
- App Router
- wallet connection
- World ID integration
- dashboards for worker, client, reviewer

Backend:
- Node.js
- Express
- TypeScript
- REST API
- background jobs
- Hedera integration layer
- World ID verification layer
- x402 gateway layer
- fetch as the standard HTTP client

Data layer:
- PostgreSQL
- Prisma
- local filesystem storage mounted as Docker volume for proof artifacts
- optional Redis later for queues/jobs

Hedera integration:
- @hashgraph/sdk
- HCS
- Scheduled Transactions
- Mirror Node REST
- account-based settlement

World integration:
- World ID 4.0 verification
- backend proof verification
- session-aware identity mapping

==================================================
21. ARCHITECTURE DIAGRAM
==================================================

                           ┌────────────────────────────┐
                           │        AI Agent / Client   │
                           │ - searches workers         │
                           │ - books one worker         │
                           │ - pays via x402 flow       │
                           └─────────────┬──────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────┐
                         │     x402-Compatible API Layer   │
                         │ - returns payment requirements  │
                         │ - receives signed payment       │
                         │ - verifies via facilitator      │
                         └─────────────┬───────────────────┘
                                       │
                                       ▼
                     ┌────────────────────────────────────────┐
                     │      Express Backend (TypeScript)      │
                     │ - order state machine                  │
                     │ - worker discovery                     │
                     │ - proof intake                         │
                     │ - dispute orchestration                │
                     │ - reputation updates                   │
                     │ - timeout jobs                         │
                     └───────┬────────────┬────────────┬──────┘
                             │            │            │
                             │            │            │
                             ▼            ▼            ▼
                  ┌────────────────┐ ┌───────────┐ ┌──────────────┐
                  │ World ID 4.0   │ │ Postgres  │ │ Local Proof  │
                  │ verify humans  │ │ app state │ │ Docker Volume│
                  └────────────────┘ └───────────┘ └──────────────┘
                             │
                             ▼
               ┌───────────────────────────────────────────────┐
               │          Hedera Integration Layer             │
               │ - HCS event writes                            │
               │ - scheduled payout creation                   │
               │ - account-based settlement                    │
               │ - mirror reconciliation                       │
               └──────────────┬───────────────────┬────────────┘
                              │                   │
                              ▼                   ▼
                    ┌──────────────────┐   ┌──────────────────┐
                    │ Hedera HCS Topic │   │ Scheduled Tx     │
                    │ ordered audit log│   │ timeout payout   │
                    └──────────────────┘   └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Mirror Node      │
                    │ indexing & audit │
                    └──────────────────┘

==================================================
22. RECOMMENDED IMPLEMENTATION DOCS
==================================================

Use these docs as the canonical implementation references:

World:
- World ID 4.0 migration / verification docs
- World ID overview
- IDKit docs if using frontend helper flows

Hedera:
- Hedera JS/TS SDK docs
- HCS docs
- Scheduled Transactions docs
- Mirror Node REST docs
- Hedera getting started docs
- Hedera x402 article
- Hedera Agent Kit docs if added later

x402:
- x402 overview
- x402 network support
- x402 facilitator docs
- buyer/seller quickstarts
- x402 MCP docs if needed later

Hackathon:
- ETHGlobal Cannes 2026 prizes page
- Hedera track page and requirements
- World track page and requirements

==================================================
23. RECOMMENDED LANGUAGES AND FRAMEWORKS
==================================================

Frontend:
- Next.js
- TypeScript
- React

Backend:
- Node.js
- Express
- TypeScript

Blockchain integration:
- @hashgraph/sdk
- Hedera Testnet
- Mirror Node REST API
- HCS
- Scheduled Transactions

Identity / verification:
- World ID 4.0

Storage / database:
- PostgreSQL
- Prisma
- local filesystem storage on Docker volume for proof files

Infrastructure:
- Docker Compose

HTTP:
- fetch

==================================================
24. SUGGESTED REPOSITORY STRUCTURE
==================================================

human-as-a-service/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ layout.tsx
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ workers/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  └─ [workerId]/page.tsx
│  │  │  │  ├─ orders/
│  │  │  │  │  └─ [orderId]/page.tsx
│  │  │  │  └─ onboarding/
│  │  │  │     └─ worker/page.tsx
│  │  │  ├─ components/
│  │  │  └─ lib/
│  │  └─ package.json
│  │
│  └─ api/
│     ├─ src/
│     │  ├─ server.ts
│     │  ├─ app.ts
│     │  ├─ routes/
│     │  │  ├─ workers.routes.ts
│     │  │  ├─ orders.routes.ts
│     │  │  ├─ world.routes.ts
│     │  │  ├─ x402.routes.ts
│     │  │  └─ hedera.routes.ts
│     │  ├─ controllers/
│     │  ├─ services/
│     │  │  ├─ workers/
│     │  │  ├─ orders/
│     │  │  ├─ world/
│     │  │  ├─ x402/
│     │  │  └─ hedera/
│     │  ├─ db/
│     │  ├─ middleware/
│     │  ├─ lib/
│     │  ├─ constants/
│     │  └─ types/
│     └─ package.json
│
├─ packages/
│  ├─ shared/
│  ├─ config/
│  └─ hedera/
│
├─ docs/
│  ├─ doc.md
│  ├─ architecture.md
│  ├─ hedera-flow.md
│  ├─ world-id-flow.md
│  └─ x402-flow.md
│
├─ docker/
│  ├─ api.Dockerfile
│  ├─ web.Dockerfile
│  └─ docker-compose.yml
│
├─ storage/
│  └─ proofs/
│
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md

==================================================
25. MVP STORAGE DECISION
==================================================

For the MVP:
- proof files are stored locally by the API
- the local storage path is mounted as a Docker volume
- metadata and references are stored in PostgreSQL through Prisma
- no IPFS
- no S3 required initially

Recommended pattern:
- save uploaded files under a structured path such as:
  /storage/proofs/{orderId}/{filename}
- save file metadata in database:
  - orderId
  - originalName
  - mimeType
  - localPath
  - fileSize
  - sha256Hash
  - uploadedAt

==================================================
26. x402 + HEDERA FUNDING FLOW
==================================================

This section is critical and must be implemented explicitly.

26.1 Payment source of truth
The payment source of truth is:
- PostgreSQL for business state
- Hedera transaction confirmation for settlement state
- HCS for auditable event chronology

26.2 Detailed payment flow
1. Agent calls:
   POST /api/orders/:id/pay

2. API responds with:
   - payment required metadata
   - amount
   - asset
   - recipient / settlement instructions
   - facilitator-compatible x402 instructions

3. Agent constructs and signs the payment payload.

4. The signed payment payload is sent through the facilitator-compatible flow.

5. Facilitator:
   - verifies the payment payload
   - checks validity and available funds
   - finalizes the transaction
   - pays fees / handles submission path
   - submits the Hedera transaction

6. Backend receives confirmation of successful funding.

7. Backend writes payment data to PostgreSQL:
   - orderId
   - x402PaymentId
   - hederaTxId
   - facilitatorId
   - payerAccount
   - amount
   - asset
   - status
   - fundedAt

8. Backend moves order to FUNDED.

9. Backend writes compact HCS event:
   - eventType=order.funded
   - orderId
   - hederaTxId
   - payer
   - amount
   - timestamp
   - nonce

26.3 Failure cases
If the payment fails:
- order remains PAYMENT_PENDING
- no HCS funded event is written
- no worker execution starts

==================================================
27. SHORT PROJECT DEFINITION
==================================================

HumanAsAService is a verified human execution platform for AI agents.
It lets an agent book one verified human for one real-world task, lock payment through a Hedera-native settlement flow, receive proof of completion, and settle through approval, timeout, or dispute resolution by verified human reviewers.

==================================================
28. ONE-PARAGRAPH EXPLANATION
==================================================

HumanAsAService is a trust layer between AI and the physical world. When an AI agent needs a real person to do something in the real world, it can book one verified human, lock payment, receive structured proof, and settle safely. World ID makes workers unique and accountable, Hedera provides the audit and settlement infrastructure, and x402 gives agents a native way to pay for access and booking.

==================================================
29. ELEVATOR PITCH
==================================================

HumanAsAService is a World ID + Hedera + x402 platform where AI agents can hire one verified human for one real-world task, with proof, reputation, timeout-based release, and reviewer-based dispute resolution.

==================================================
30. BUILD PRIORITIES
==================================================

Priority 1:
- monorepo setup
- Next.js app shell
- Express API shell
- Prisma + PostgreSQL
- Docker Compose
- local proof storage volume

Priority 2:
- worker onboarding
- World ID verification flow
- worker profile CRUD
- worker search endpoint

Priority 3:
- order creation
- order state machine
- x402-compatible payment endpoint
- facilitator-compatible payment verification
- Hedera funding flow
- HCS event writer

Priority 4:
- proof upload
- review window
- scheduled timeout release
- client approval path
- schedule deletion path

Priority 5:
- dispute opening
- reviewer selection
- reviewer voting
- reputation updates
- mirror reconciliation

==================================================
31. IMPORTANT IMPLEMENTATION NOTES
==================================================

- Keep the MVP simple.
- One worker only.
- One order only.
- One clean proof flow.
- One dispute mechanism.
- No Solidity.
- No IPFS.
- No over-engineering.
- Use fetch as the default HTTP client.
- Do not treat HCS as primary storage.
- Do not create timeout schedules without an admin key.
- Do not use World nullifier as the durable worker identity.
- Optimize for a convincing hackathon demo and a clean developer experience.