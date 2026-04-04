type StatusPillProps = {
  status: string;
};

type PillStyle = {
  bg: string;
  text: string;
  border: string;
};

const statusMap: Record<string, PillStyle> = {
  DRAFT: { bg: "bg-transparent", text: "text-[var(--color-muted)]", border: "border-dashed border-[var(--color-muted)]" },
  PAYMENT_PENDING: { bg: "bg-transparent", text: "text-[var(--color-warning)]", border: "border-dashed border-[var(--color-warning)]" },
  FUNDED: { bg: "bg-[var(--color-primary)]", text: "text-[var(--color-primary-contrast)]", border: "border-[var(--color-border-strong)]" },
  IN_PROGRESS: { bg: "bg-[var(--color-primary)]", text: "text-[var(--color-primary-contrast)]", border: "border-[var(--color-border-strong)]" },
  PROOF_SUBMITTED: { bg: "bg-[var(--color-accent)]", text: "text-white", border: "border-[var(--color-accent)]" },
  REVIEW_WINDOW: { bg: "bg-[var(--color-accent)]", text: "text-white", border: "border-[var(--color-accent)]" },
  APPROVED: { bg: "bg-[var(--color-success)]", text: "text-white", border: "border-[var(--color-success)]" },
  DISPUTED: { bg: "bg-[var(--color-danger)]", text: "text-white", border: "border-[var(--color-danger)]" },
  AUTO_RELEASED: { bg: "bg-[var(--color-success)]", text: "text-white", border: "border-[var(--color-success)]" },
  REFUNDED: { bg: "bg-transparent", text: "text-[var(--color-danger)]", border: "border-[var(--color-danger)]" },
  SPLIT_SETTLED: { bg: "bg-transparent", text: "text-[var(--color-warning)]", border: "border-[var(--color-warning)]" },
  CANCELLED: { bg: "bg-transparent", text: "text-[var(--color-muted)]", border: "border-[var(--color-muted)]" },
  FAILED: { bg: "bg-[var(--color-danger)]", text: "text-white", border: "border-[var(--color-danger)]" },
  OPEN: { bg: "bg-[var(--color-accent)]", text: "text-white", border: "border-[var(--color-accent)]" },
  RESOLVED: { bg: "bg-[var(--color-success)]", text: "text-white", border: "border-[var(--color-success)]" },
};

const fallback: PillStyle = {
  bg: "bg-transparent",
  text: "text-[var(--color-muted)]",
  border: "border-[var(--color-border)]",
};

export function StatusPill({ status }: StatusPillProps) {
  const style = statusMap[status] ?? fallback;

  return (
    <span
      className={`inline-flex items-center border-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
