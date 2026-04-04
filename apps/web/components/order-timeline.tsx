const LIFECYCLE = [
  "DRAFT",
  "PAYMENT_PENDING",
  "FUNDED",
  "IN_PROGRESS",
  "PROOF_SUBMITTED",
  "REVIEW_WINDOW",
  "SETTLED",
] as const;

const DISPLAY: Record<string, string> = {
  DRAFT: "Draft",
  PAYMENT_PENDING: "Payment",
  FUNDED: "Funded",
  IN_PROGRESS: "In Progress",
  PROOF_SUBMITTED: "Proof",
  REVIEW_WINDOW: "Review",
  SETTLED: "Settled",
};

const SETTLED_STATUSES = new Set([
  "APPROVED",
  "DISPUTED",
  "AUTO_RELEASED",
  "REFUNDED",
  "SPLIT_SETTLED",
]);

type OrderTimelineProps = {
  status: string;
};

export function OrderTimeline({ status }: OrderTimelineProps) {
  const effectiveStatus = SETTLED_STATUSES.has(status) ? "SETTLED" : status;
  const currentIndex = LIFECYCLE.indexOf(effectiveStatus as typeof LIFECYCLE[number]);

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      {LIFECYCLE.map((stage, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <div key={stage} className="flex items-center">
            {index > 0 ? (
              <div
                className={`h-0.5 w-4 sm:w-8 ${done ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
              />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-3 w-3 border-2 ${
                  done
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                    : active
                      ? "border-[var(--color-primary)] bg-[var(--color-surface)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]"
                }`}
              />
              <span
                className={`whitespace-nowrap text-[10px] font-bold ${
                  done || active ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"
                }`}
              >
                {active && SETTLED_STATUSES.has(status)
                  ? status.replace(/_/g, " ")
                  : DISPLAY[stage]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
