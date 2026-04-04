export type WorkerProfile = {
  id: string;
  verifiedHumanId: string;
  displayName: string;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  languages: unknown;
  skills: unknown;
  availabilityStatus: string;
  baseRate: string;
  acceptedProofTypes: unknown;
  ratingAvg: number;
  completedJobs: number;
  approvalRate: number;
  disputeRate: number;
  disputeLossRate: number;
  reputationScore: number;
  reviewerEligible: boolean;
  isSuspended: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkerListResponse = {
  items: WorkerProfile[];
  count: number;
};

export type WorldVerifyResponse = {
  verifiedHumanId: string;
  worldSessionId: string;
  walletAddress: string | null;
  worldVerified: boolean;
};

export type WalletIdentityResponse = {
  verifiedHumanId: string;
  worldSessionId: string;
  walletAddress: string | null;
  worldVerified: boolean;
  worker: {
    id: string;
    displayName: string;
    reviewerEligible: boolean;
  } | null;
};

export type FundingSummary = {
  status: "PENDING" | "CONFIRMED" | "FAILED";
  x402PaymentId: string;
  hederaTxId: string | null;
  payerAccount: string | null;
  fundedAt: string | null;
} | null;

export type DisputeSummary = {
  id: string;
  status: "OPEN" | "RESOLVED";
  resolution: "RELEASE_TO_WORKER" | "REFUND_CLIENT" | "SPLIT_PAYMENT" | null;
  assignedReviewerIds: unknown;
} | null;

export type OrderSummary = {
  id: string;
  clientId: string;
  clientAccountId: string | null;
  workerId: string;
  title: string;
  objective: string;
  instructions: string;
  amount: string;
  currency: string;
  reviewWindowHours: number;
  status:
    | "DRAFT"
    | "PAYMENT_PENDING"
    | "FUNDED"
    | "IN_PROGRESS"
    | "PROOF_SUBMITTED"
    | "REVIEW_WINDOW"
    | "APPROVED"
    | "DISPUTED"
    | "AUTO_RELEASED"
    | "REFUNDED"
    | "SPLIT_SETTLED"
    | "CANCELLED"
    | "FAILED";
  proofSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  funding: FundingSummary;
  dispute: DisputeSummary;
};

export type OrderListResponse = {
  items: OrderSummary[];
  count: number;
};

export type ProofArtifact = {
  id: string;
  orderId: string;
  originalName: string;
  mimeType: string;
  localPath: string;
  fileSize: string;
  sha256Hash: string;
  uploadedAt: string;
};

export type ProofListResponse = {
  items: ProofArtifact[];
  count: number;
};

export type DisputeDetail = {
  id: string;
  orderId: string;
  reasonCode: string;
  clientStatement: string;
  workerStatement: string | null;
  assignedReviewerIds: string[];
  status: "OPEN" | "RESOLVED";
  resolution: "RELEASE_TO_WORKER" | "REFUND_CLIENT" | "SPLIT_PAYMENT" | null;
  resolvedAt: string | null;
  votes: Array<{
    reviewerId: string;
    vote: "RELEASE_TO_WORKER" | "REFUND_CLIENT" | "SPLIT_PAYMENT";
    submittedAt: string;
  }>;
};

export type AuditTimelineResponse = {
  order: {
    id: string;
    status: string;
    proofSubmittedAt: string | null;
    scheduleId: string | null;
  };
  funding: {
    status: string;
    x402PaymentId: string;
    hederaTxId: string | null;
    fundedAt: string | null;
  } | null;
  ledger: {
    fundingTxId: string | null;
    releaseTxId: string | null;
    refundTxId: string | null;
    escrowAccountId: string | null;
    hederaNetwork: string;
    facilitatorId: string | null;
    payerAccount: string | null;
    asset: string | null;
    fundedAt: string | null;
  } | null;
  checks: {
    fundingConfirmed: boolean;
    proofAnchored: boolean;
    reviewWindowAnchored: boolean;
    scheduleConsistent: boolean;
  };
  timeline: Array<{
    timestamp: string;
    eventType: string;
    actorId: string | null;
    txId: string | null;
    proofHash: string | null;
    storageRef: string | null;
    resolution: string | null;
  }>;
  mirror?: {
    baseUrl: string;
    topicId: string | null;
    transactions: Array<{
      txId: string;
      consensusTimestamp: string;
      result: string;
      name: string;
      entityId: string | null;
      memo: string;
      scheduled: boolean;
    }>;
    topicMessages: Array<{
      sequenceNumber: number;
      consensusTimestamp: string;
      payerAccountId: string;
      eventType: string | null;
      txId: string | null;
      nonce: string | null;
      messageTimestamp: string | null;
    }>;
  };
};

export type ReputationWorkerResponse = {
  workerId: string;
  score: number;
  averageRating: number;
  completedJobs: number;
  approvalRate: number;
  disputeRate: number;
  disputeLossRate: number;
};

export type ReputationReviewerResponse = {
  reviewerId: string;
  trustScore: number;
  reviewsCompleted: number;
  majorityAlignmentRate: number;
  reviewSpeedScore: number;
  consistencyScore: number;
  abuseReports: number;
};
