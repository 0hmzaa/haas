type StatusPillProps = {
  status: string;
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-stone-200 text-stone-800",
  PAYMENT_PENDING: "bg-amber-200 text-amber-900",
  FUNDED: "bg-emerald-200 text-emerald-900",
  IN_PROGRESS: "bg-blue-200 text-blue-900",
  PROOF_SUBMITTED: "bg-indigo-200 text-indigo-900",
  REVIEW_WINDOW: "bg-purple-200 text-purple-900",
  APPROVED: "bg-emerald-300 text-emerald-950",
  DISPUTED: "bg-red-200 text-red-900",
  AUTO_RELEASED: "bg-teal-200 text-teal-900",
  REFUNDED: "bg-orange-200 text-orange-900",
  SPLIT_SETTLED: "bg-violet-200 text-violet-900",
  CANCELLED: "bg-zinc-300 text-zinc-900",
  FAILED: "bg-red-300 text-red-950",
  OPEN: "bg-amber-200 text-amber-900",
  RESOLVED: "bg-emerald-200 text-emerald-900"
};

export function StatusPill({ status }: StatusPillProps) {
  const cls = STATUS_CLASS[status] ?? "bg-zinc-200 text-zinc-900";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
