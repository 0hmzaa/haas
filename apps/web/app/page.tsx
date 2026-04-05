import Link from "next/link";
import { SectionDivider } from "../components/section-divider";

const STEPS = [
  {
    num: "01",
    title: "Discover",
    desc: "AI agent searches for a verified human by skill, location, and reputation score.",
  },
  {
    num: "02",
    title: "Book",
    desc: "Direct booking. One worker, one task. No bidding, no marketplace noise.",
  },
  {
    num: "03",
    title: "Fund",
    desc: "x402-compatible payment locks funds in a Hedera-native escrow flow. No Solidity.",
  },
  {
    num: "04",
    title: "Execute & Prove",
    desc: "Worker performs the task in the real world. Proof is uploaded, hashed, and anchored to HCS.",
  },
  {
    num: "05",
    title: "Settle",
    desc: "Client approves, disputes, or stays silent. 72-hour auto-release. Hedera handles settlement.",
  },
];

const TECH = [
  {
    name: "World ID",
    tagline: "Proof of Human",
    desc: "Every worker is verified unique through World ID biometric verification. No duplicate accounts, no bots, no fakes.",
  },
  {
    name: "Hedera",
    tagline: "Settlement Layer",
    desc: "Account transfers, HCS audit timeline, scheduled transactions for timeout release, Mirror Node transparency.",
  },
  {
    name: "x402",
    tagline: "Agent-Native Payments",
    desc: "AI agents pay programmatically through an HTTP-native payment protocol. No wallet popups, no manual signing.",
  },
];

const USE_CASES = [
  { title: "On-Site Verification", desc: "Check if a store is open, verify a delivery, confirm a physical condition." },
  { title: "Document Pickup", desc: "Retrieve signed documents, notarized papers, or physical packages." },
  { title: "Location Photography", desc: "Photograph a specific location, storefront, or event for remote verification." },
  { title: "Product QA", desc: "Physically inspect a product, check quality, or verify authenticity." },
  { title: "In-Person Witness", desc: "Serve as a verifiable witness for a real-world event or transaction." },
  { title: "Local Research", desc: "Conduct local market research, price checks, or competitive analysis." },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* ── SVG Halftone Filter (hidden) ─────────── */}
      <svg width="0" height="0" className="absolute">
        <filter id="halftone-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
          <feComponentTransfer in="blur" result="discrete">
            <feFuncR type="discrete" tableValues="0 0.15 0.3 0.5 0.7 0.85 1" />
            <feFuncG type="discrete" tableValues="0 0.15 0.3 0.5 0.7 0.85 1" />
            <feFuncB type="discrete" tableValues="0 0.15 0.3 0.5 0.7 0.85 1" />
          </feComponentTransfer>
        </filter>
      </svg>

      {/* ── Hero ──────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-2 border-[var(--color-border-strong)]">
        <div className="halftone-hero absolute inset-0" />
        <div className="halftone-hero-overlay" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-36">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            World ID + Hedera + x402
          </p>
          <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[1.0] tracking-tight text-[var(--color-text)] md:text-8xl">
            Human as a Service
          </h1>
          <p className="mt-4 max-w-2xl text-xl font-bold tracking-tight text-[var(--color-text)] md:text-2xl opacity-80">
            The Verified Human Execution Layer
          </p>
          <p className="mt-6 max-w-xl text-lg text-[var(--color-muted)]">
            Book one verified human for one real-world task. Lock payment.
            Receive proof. Settle on Hedera.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/workers"
              className="inline-flex items-center border-2 border-[var(--color-border-strong)] bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-[var(--color-primary-contrast)] shadow-[4px_4px_0_var(--color-border-strong)] transition-all hover:shadow-[2px_2px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              Browse Workers
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-3 text-sm font-bold text-[var(--color-text)] shadow-[4px_4px_0_var(--color-border-strong)] transition-all hover:shadow-[2px_2px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              Read the Docs
            </Link>
          </div>

          {/* Flow diagram */}
          <div className="mt-16 flex flex-wrap items-center gap-4 text-xs font-bold">
            <div className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 shadow-[3px_3px_0_var(--color-border-strong)]">
              AI Agent
            </div>
            <span className="text-[var(--color-muted)]">---&gt;</span>
            <div className="border-2 border-[var(--color-border-strong)] bg-[var(--color-primary)] px-4 py-3 text-[var(--color-primary-contrast)] shadow-[3px_3px_0_var(--color-border-strong)]">
              Verified Human
            </div>
            <span className="text-[var(--color-muted)]">---&gt;</span>
            <div className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 shadow-[3px_3px_0_var(--color-border-strong)]">
              Proof + Settlement
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ── How It Works ─────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Protocol
        </p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-[var(--color-text)]">
          How It Works
        </h2>

        <div className="mt-12 grid gap-0 md:grid-cols-5">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="border-2 border-[var(--color-border-strong)] border-b-0 p-5 last:border-b-2 md:border-b-2 md:border-r-0 md:last:border-r-2"
            >
              <span className="font-mono text-3xl font-black text-[var(--color-border)]">
                {step.num}
              </span>
              <h3 className="mt-3 text-base font-bold text-[var(--color-text)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ── Technology Stack ──────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Infrastructure
        </p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-[var(--color-text)]">
          Built On
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TECH.map((t) => (
            <div
              key={t.name}
              className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 shadow-[6px_6px_0_var(--color-border-strong)]"
            >
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                {t.tagline}
              </p>
              <h3 className="mt-2 text-2xl font-black text-[var(--color-text)]">
                {t.name}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ── Use Cases ────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Applications
        </p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-[var(--color-text)]">
          What Can Agents Book Humans For?
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="border-2 border-[var(--color-border-strong)] p-5 shadow-[4px_4px_0_var(--color-border-strong)]"
            >
              <h3 className="text-base font-bold text-[var(--color-text)]">
                {uc.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {uc.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ── For Humans / For Agents ──────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 shadow-[6px_6px_0_var(--color-border-strong)]">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
              For Humans
            </p>
            <h3 className="mt-2 text-2xl font-black text-[var(--color-text)]">
              Become a Worker
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              Verify your identity with World ID, create a profile, and start
              earning HBAR by completing real-world tasks for AI agents. Build
              reputation, unlock reviewer status.
            </p>
            <Link
              href="/app/worker/onboarding"
              className="mt-6 inline-flex items-center border-2 border-[var(--color-border-strong)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--color-primary-contrast)] shadow-[3px_3px_0_var(--color-border-strong)] transition-all hover:shadow-[1px_1px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              Start Onboarding
            </Link>
          </div>

          <div className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 shadow-[6px_6px_0_var(--color-border-strong)]">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
              For AI Agents
            </p>
            <h3 className="mt-2 text-2xl font-black text-[var(--color-text)]">
              API-First Integration
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              REST API for worker discovery, direct booking, x402 payment, proof
              retrieval, and settlement. No frontend required. Built for
              autonomous agent workflows.
            </p>
            <Link
              href="/docs"
              className="mt-6 inline-flex items-center border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-bold text-[var(--color-text)] shadow-[3px_3px_0_var(--color-border-strong)] transition-all hover:shadow-[1px_1px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              Read API Docs
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-[var(--color-muted)]">
            <Link href="/workers" className="hover:text-[var(--color-text)]">
              Workers
            </Link>
            <Link href="/docs" className="hover:text-[var(--color-text)]">
              Docs
            </Link>
            <Link href="/app" className="hover:text-[var(--color-text)]">
              Workspace
            </Link>
          </div>
          <p className="font-mono text-xs text-[var(--color-muted)]">
            Built for ETHGlobal Cannes 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
