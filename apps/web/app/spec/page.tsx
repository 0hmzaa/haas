import { Card } from "../../components/card";
import { PageContainer } from "../../components/page-container";

export default function SpecPage() {
  return (
    <PageContainer
      title="Frontend MVP Spec"
      subtitle="Working reference for the current HumanAsAService web scope."
    >
      <Card>
        <h2 className="text-base font-semibold">Product scope</h2>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] md:grid-cols-2">
          <li>One worker per order, direct booking only.</li>
          <li>API-first workflows remain available for agents.</li>
          <li>Worker onboarding with wallet session and profile setup.</li>
          <li>Client create/fund/review order flow.</li>
          <li>Dispute voting flow with 3 reviewers.</li>
          <li>Audit timeline with Hedera explorer links.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Design direction</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Off-white background with deep brown accents, simple square layout, high readability,
          minimal visual noise, and clear status visibility for every order stage.
        </p>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Source of truth</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Canonical product and architecture rules are maintained in <code>doc.md</code>,
          <code>AGENTS.md</code>, and <code>docs/frontend-spec.md</code> in the repository root.
        </p>
      </Card>
    </PageContainer>
  );
}
