"use client";

import { PageContainer } from "../../components/page-container";
import { TabGroup } from "../../components/tab-group";
import { CodeBlock } from "../../components/code-block";

function HumanDocs() {
  return (
    <div className="grid gap-10">
      {/* Getting Started */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Getting Started as a Worker
        </h3>
        <div className="mt-4 grid gap-4">
          <div className="border-2 border-[var(--color-border-strong)] p-5">
            <span className="font-mono text-xs font-bold text-[var(--color-muted)]">Step 1</span>
            <h4 className="mt-1 font-bold">Connect Your Wallet</h4>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Install HashPack wallet for Hedera. Click "Connect Wallet" in the navigation bar.
              Your Hedera account ID (0.0.xxxxx) becomes your platform identity.
            </p>
          </div>
          <div className="border-2 border-[var(--color-border-strong)] p-5">
            <span className="font-mono text-xs font-bold text-[var(--color-muted)]">Step 2</span>
            <h4 className="mt-1 font-bold">Complete Your Profile</h4>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Go to Workspace &gt; Onboarding. Fill in your display name, location, skills,
              hourly rate in HBAR, and a short bio. Skills are comma-separated (e.g. "delivery, photography, verification").
            </p>
          </div>
          <div className="border-2 border-[var(--color-border-strong)] p-5">
            <span className="font-mono text-xs font-bold text-[var(--color-muted)]">Step 3</span>
            <h4 className="mt-1 font-bold">World ID Verification</h4>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              World ID proves you are a unique human. This prevents Sybil attacks and fake worker accounts.
              Verification is integrated into the onboarding flow. Once verified, you become bookable.
            </p>
          </div>
        </div>
      </section>

      {/* How Booking Works */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          How Booking Works
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          A client or AI agent finds you through the worker directory. They filter by location, skills,
          rate, and reputation. When they find the right match, they create an order with a specific task.
          Payment is locked before you start work -- funds are held in a Hedera-native escrow flow
          controlled by the platform. You never start work without guaranteed payment.
        </p>
      </section>

      {/* Completing Tasks */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Completing Tasks &amp; Proof
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          Once the order is funded and you accept, the status moves to IN_PROGRESS. Read the task
          instructions carefully. Perform the work in the real world. Then upload proof -- photos,
          documents, or text summaries. Every proof artifact is SHA-256 hashed and anchored to
          Hedera Consensus Service (HCS) for tamper-evident auditability.
        </p>
      </section>

      {/* Review Window */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Review Window (72 Hours)
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          After proof submission, the client has a configurable review window (default 72 hours).
          Three outcomes are possible:
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--color-muted)]">
          <li className="border-l-4 border-[var(--color-success)] pl-3">
            <strong>Approve</strong> -- Instant payout to your wallet. Settlement executes on Hedera.
          </li>
          <li className="border-l-4 border-[var(--color-danger)] pl-3">
            <strong>Dispute</strong> -- Payout frozen. 3 verified human reviewers arbitrate.
          </li>
          <li className="border-l-4 border-[var(--color-muted)] pl-3">
            <strong>Silence</strong> -- After 72 hours, automatic payout via scheduled Hedera transaction.
          </li>
        </ul>
      </section>

      {/* Disputes */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Disputes
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          If a client disputes, 3 verified human reviewers are assigned. They inspect the task
          instructions, acceptance criteria, proof artifacts, dispute reason, and your response.
          Each reviewer votes: RELEASE_TO_WORKER, REFUND_CLIENT, or SPLIT_PAYMENT. Majority wins.
          If all 3 votes differ, SPLIT_PAYMENT is the default resolution.
        </p>
      </section>

      {/* Reputation */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Reputation System
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          Your reputation score (0-100) depends on: completed jobs, approval rate, dispute rate,
          dispute loss rate, proof quality, and client ratings. Higher reputation means more bookings
          and higher trust. Reach a threshold and you become eligible as a dispute reviewer --
          earning additional fees for reviewing other workers' cases.
        </p>
      </section>
    </div>
  );
}

function AgentDocs() {
  return (
    <div className="grid gap-10">
      {/* Overview */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          API Overview
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          HumanAsAService exposes a REST API for programmatic access. All endpoints accept and return JSON.
          Base URL for local development:
        </p>
        <CodeBlock language="text" code="http://localhost:4000/api" />
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          No authentication headers required for MVP. Orders are linked to client wallet addresses.
        </p>
      </section>

      {/* Worker Discovery */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Worker Discovery
        </h3>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Search for available workers by location, skill, and reputation.
        </p>
        <CodeBlock
          language="bash"
          code={`# List available workers filtered by skill
curl "http://localhost:4000/api/workers?skill=verification&availabilityStatus=AVAILABLE"

# Get a specific worker profile
curl "http://localhost:4000/api/workers/{workerId}"`}
        />
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Query params: <code className="font-mono text-xs">country</code>, <code className="font-mono text-xs">city</code>,
          {" "}<code className="font-mono text-xs">skill</code>, <code className="font-mono text-xs">availabilityStatus</code>,
          {" "}<code className="font-mono text-xs">minRating</code>.
        </p>
      </section>

      {/* Order Lifecycle */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Order Lifecycle
        </h3>
        <CodeBlock
          language="bash"
          code={`# 1. Create order
curl -X POST http://localhost:4000/api/orders \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientId": "client:0_0_12345",
    "clientAccountId": "0.0.12345",
    "workerId": "worker-uuid",
    "title": "Verify storefront",
    "objective": "Confirm the store at 123 Main St is open",
    "instructions": "Visit location, photograph storefront, report status",
    "amount": "5.00",
    "currency": "HBAR",
    "reviewWindowHours": 72
  }'

# 2. Get payment requirements (x402)
curl -X POST http://localhost:4000/api/orders/{id}/pay

# 3. Submit signed payment
curl -X POST http://localhost:4000/api/orders/{id}/pay/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "x402PaymentId": "payment-id",
    "signedPayload": { "x402": "signed-data" },
    "payerAccount": "0.0.12345"
  }'

# 4. Check order status
curl http://localhost:4000/api/orders/{id}

# 5. Approve order (release payment)
curl -X POST http://localhost:4000/api/orders/{id}/approve \\
  -H "Content-Type: application/json" \\
  -d '{ "actorId": "client:0_0_12345" }'`}
        />
      </section>

      {/* x402 Payment */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          x402 Payment Flow
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          x402 is the agent-facing payment interface. The flow:
        </p>
        <ol className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] list-decimal pl-5">
          <li>Agent calls <code className="font-mono text-xs">POST /api/orders/:id/pay</code> to get payment requirements</li>
          <li>API returns x402 payment metadata: amount, asset, payTo, network, facilitator info</li>
          <li>Agent constructs and signs the payment payload</li>
          <li>Agent submits via <code className="font-mono text-xs">POST /api/orders/:id/pay/submit</code></li>
          <li>Facilitator verifies and submits the Hedera transaction</li>
          <li>Backend confirms funding, writes HCS event, moves order to FUNDED</li>
        </ol>
      </section>

      {/* Order States */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Order State Machine
        </h3>
        <CodeBlock
          language="text"
          code={`DRAFT -> PAYMENT_PENDING -> FUNDED -> IN_PROGRESS -> PROOF_SUBMITTED
  -> REVIEW_WINDOW -> APPROVED | DISPUTED | AUTO_RELEASED

DISPUTED -> REFUNDED | SPLIT_SETTLED | APPROVED`}
        />
      </section>

      {/* Dispute */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Dispute Resolution
        </h3>
        <CodeBlock
          language="bash"
          code={`# Open dispute
curl -X POST http://localhost:4000/api/orders/{id}/dispute \\
  -H "Content-Type: application/json" \\
  -d '{
    "reasonCode": "QUALITY_ISSUE",
    "clientStatement": "Proof does not match instructions",
    "actorId": "client:0_0_12345"
  }'

# Get dispute details
curl http://localhost:4000/api/orders/{id}/dispute

# Worker responds to dispute
curl -X POST http://localhost:4000/api/orders/{id}/dispute/respond \\
  -H "Content-Type: application/json" \\
  -d '{
    "workerStatement": "Work completed as instructed"
  }'

# Reviewer votes
curl -X POST http://localhost:4000/api/orders/{id}/dispute/vote \\
  -H "Content-Type: application/json" \\
  -d '{
    "reviewerId": "verified-human-id",
    "vote": "RELEASE_TO_WORKER"
  }'`}
        />
      </section>

      {/* Audit */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Audit Trail
        </h3>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Every lifecycle event is written to Hedera Consensus Service. Query the full timeline:
        </p>
        <CodeBlock
          language="bash"
          code={`curl http://localhost:4000/api/orders/{id}/audit

# Returns: order state, funding details, HCS events timeline,
# Hedera transaction IDs, Mirror Node references, consistency checks`}
        />
      </section>

      {/* All Endpoints */}
      <section>
        <h3 className="text-2xl font-black tracking-tight text-[var(--color-text)]">
          Complete Endpoint Reference
        </h3>
        <div className="mt-4 border-2 border-[var(--color-border-strong)] text-sm">
          {[
            ["GET", "/api/workers", "List workers with filters"],
            ["GET", "/api/workers/:id", "Get worker profile"],
            ["POST", "/api/workers", "Create worker profile"],
            ["PATCH", "/api/workers/:id", "Update worker profile"],
            ["POST", "/api/world/verify", "World ID verification"],
            ["GET", "/api/world/identity?wallet=", "Get identity by wallet"],
            ["POST", "/api/orders", "Create order"],
            ["GET", "/api/orders/:id", "Get order details"],
            ["POST", "/api/orders/:id/pay", "Get payment requirement"],
            ["POST", "/api/orders/:id/pay/submit", "Submit signed payment"],
            ["POST", "/api/orders/:id/start", "Start order execution"],
            ["POST", "/api/orders/:id/proof", "Upload proof (multipart)"],
            ["GET", "/api/orders/:id/proof", "List proof artifacts"],
            ["POST", "/api/orders/:id/approve", "Approve and release"],
            ["POST", "/api/orders/:id/dispute", "Open dispute"],
            ["GET", "/api/orders/:id/dispute", "Get dispute details"],
            ["POST", "/api/orders/:id/dispute/respond", "Worker response"],
            ["POST", "/api/orders/:id/dispute/vote", "Reviewer vote"],
            ["GET", "/api/orders/:id/audit", "Audit timeline"],
            ["GET", "/api/reputation/workers/:id", "Worker reputation"],
            ["GET", "/api/reputation/reviewers/:id", "Reviewer reputation"],
          ].map(([method, path, desc]) => (
            <div
              key={`${method}-${path}`}
              className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2 last:border-b-0"
            >
              <span className={`w-14 shrink-0 font-mono text-xs font-bold ${method === "GET" ? "text-[var(--color-success)]" : method === "POST" ? "text-[var(--color-accent)]" : "text-[var(--color-warning)]"}`}>
                {method}
              </span>
              <span className="font-mono text-xs text-[var(--color-text)]">{path}</span>
              <span className="ml-auto hidden text-xs text-[var(--color-muted)] sm:block">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DocsPage() {
  return (
    <PageContainer
      title="Documentation"
      subtitle="Everything you need to know about HumanAsAService -- whether you're a human worker or an AI agent."
      wide
    >
      <TabGroup
        tabs={[
          { label: "For Humans", content: <HumanDocs /> },
          { label: "For AI Agents", content: <AgentDocs /> },
        ]}
      />
    </PageContainer>
  );
}
