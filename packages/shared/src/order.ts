export const ORDER_STATUSES = [
  "DRAFT",
  "PAYMENT_PENDING",
  "FUNDED",
  "IN_PROGRESS",
  "PROOF_SUBMITTED",
  "REVIEW_WINDOW",
  "APPROVED",
  "DISPUTED",
  "AUTO_RELEASED",
  "REFUNDED",
  "SPLIT_SETTLED",
  "CANCELLED",
  "FAILED"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PAYMENT_PENDING", "CANCELLED", "FAILED"],
  PAYMENT_PENDING: ["FUNDED", "CANCELLED", "FAILED"],
  FUNDED: ["IN_PROGRESS", "CANCELLED", "FAILED"],
  IN_PROGRESS: ["PROOF_SUBMITTED", "CANCELLED", "FAILED"],
  PROOF_SUBMITTED: ["REVIEW_WINDOW", "CANCELLED", "FAILED"],
  REVIEW_WINDOW: ["APPROVED", "DISPUTED", "AUTO_RELEASED", "FAILED"],
  APPROVED: [],
  DISPUTED: ["REFUNDED", "SPLIT_SETTLED", "APPROVED", "FAILED"],
  AUTO_RELEASED: [],
  REFUNDED: [],
  SPLIT_SETTLED: [],
  CANCELLED: [],
  FAILED: []
};

export function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  return ORDER_TRANSITIONS[current].includes(next);
}

export function assertTransition(current: OrderStatus, next: OrderStatus): void {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid order transition: ${current} -> ${next}`);
  }
}
