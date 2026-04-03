-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PAYMENT_PENDING', 'FUNDED', 'IN_PROGRESS', 'PROOF_SUBMITTED', 'REVIEW_WINDOW', 'APPROVED', 'DISPUTED', 'AUTO_RELEASED', 'REFUNDED', 'SPLIT_SETTLED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('RELEASE_TO_WORKER', 'REFUND_CLIENT', 'SPLIT_PAYMENT');

-- CreateEnum
CREATE TYPE "HcsEventType" AS ENUM ('order_created', 'order_funded', 'order_started', 'proof_submitted', 'review_window_started', 'order_approved', 'order_disputed', 'reviewer_vote_submitted', 'order_resolved', 'order_auto_released', 'order_refunded');

-- CreateTable
CREATE TABLE "VerifiedHuman" (
    "id" TEXT NOT NULL,
    "worldSessionId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "worldVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedHuman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldNullifier" (
    "id" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "verifiedHumanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldNullifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL,
    "verifiedHumanId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "country" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "languages" JSONB,
    "skills" JSONB,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "baseRate" DECIMAL(18,6) NOT NULL,
    "acceptedProofTypes" JSONB,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "approvalRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disputeLossRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewerEligible" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "locationContext" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "expectedDurationMinutes" INTEGER,
    "requiredProofSchema" JSONB,
    "acceptanceCriteria" JSONB,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HBAR',
    "platformFeeBps" INTEGER NOT NULL DEFAULT 0,
    "reviewerFeeReserve" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "reviewWindowHours" INTEGER NOT NULL DEFAULT 72,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "proofSubmittedAt" TIMESTAMP(3),
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "x402PaymentId" TEXT NOT NULL,
    "hederaTxId" TEXT,
    "facilitatorId" TEXT,
    "payerAccount" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'HBAR',
    "status" "FundingStatus" NOT NULL DEFAULT 'PENDING',
    "fundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofArtifact" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "checklistJson" JSONB,
    "structuredJson" JSONB,
    "geoMetadata" JSONB,
    "timeMetadata" JSONB,
    "confidenceStatement" TEXT,

    CONSTRAINT "ProofArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "clientStatement" TEXT NOT NULL,
    "workerStatement" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "DisputeResolution",
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeVote" (
    "id" TEXT NOT NULL,
    "disputeCaseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "vote" "DisputeResolution" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationRecord" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER,
    "approved" BOOLEAN NOT NULL,
    "timely" BOOLEAN NOT NULL,
    "disputed" BOOLEAN NOT NULL,
    "disputeOutcome" "DisputeResolution",
    "proofQualityScore" INTEGER,
    "reviewerFeedback" TEXT,
    "deltaScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerReputation" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewsCompleted" INTEGER NOT NULL DEFAULT 0,
    "majorityAlignmentRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewSpeedScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abuseReports" INTEGER NOT NULL DEFAULT 0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HederaOrderLedger" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "hederaNetwork" TEXT NOT NULL DEFAULT 'testnet',
    "escrowAccountId" TEXT,
    "scheduleId" TEXT,
    "topicId" TEXT,
    "fundingTxId" TEXT,
    "proofMessageSequence" TEXT,
    "disputeMessageSequence" TEXT,
    "releaseTxId" TEXT,
    "refundTxId" TEXT,
    "x402PaymentId" TEXT,
    "facilitatorId" TEXT,
    "payerAccount" TEXT,
    "asset" TEXT,
    "fundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HederaOrderLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HcsEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "eventType" "HcsEventType" NOT NULL,
    "actorId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proofHash" TEXT,
    "storageRef" TEXT,
    "resolution" "DisputeResolution",
    "txId" TEXT,
    "nonce" TEXT,
    "payload" JSONB,

    CONSTRAINT "HcsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedHuman_worldSessionId_key" ON "VerifiedHuman"("worldSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedHuman_walletAddress_key" ON "VerifiedHuman"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "WorldNullifier_nullifier_key" ON "WorldNullifier"("nullifier");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_verifiedHumanId_key" ON "WorkerProfile"("verifiedHumanId");

-- CreateIndex
CREATE INDEX "Order_workerId_idx" ON "Order"("workerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRecord_orderId_key" ON "FundingRecord"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRecord_x402PaymentId_key" ON "FundingRecord"("x402PaymentId");

-- CreateIndex
CREATE INDEX "ProofArtifact_orderId_idx" ON "ProofArtifact"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeCase_orderId_key" ON "DisputeCase"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeVote_disputeCaseId_reviewerId_key" ON "DisputeVote"("disputeCaseId", "reviewerId");

-- CreateIndex
CREATE INDEX "ReputationRecord_workerId_idx" ON "ReputationRecord"("workerId");

-- CreateIndex
CREATE INDEX "ReputationRecord_orderId_idx" ON "ReputationRecord"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerReputation_reviewerId_key" ON "ReviewerReputation"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "HederaOrderLedger_orderId_key" ON "HederaOrderLedger"("orderId");

-- CreateIndex
CREATE INDEX "HcsEvent_orderId_timestamp_idx" ON "HcsEvent"("orderId", "timestamp");

-- AddForeignKey
ALTER TABLE "WorldNullifier" ADD CONSTRAINT "WorldNullifier_verifiedHumanId_fkey" FOREIGN KEY ("verifiedHumanId") REFERENCES "VerifiedHuman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_verifiedHumanId_fkey" FOREIGN KEY ("verifiedHumanId") REFERENCES "VerifiedHuman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingRecord" ADD CONSTRAINT "FundingRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofArtifact" ADD CONSTRAINT "ProofArtifact_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeVote" ADD CONSTRAINT "DisputeVote_disputeCaseId_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "DisputeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeVote" ADD CONSTRAINT "DisputeVote_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "VerifiedHuman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRecord" ADD CONSTRAINT "ReputationRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRecord" ADD CONSTRAINT "ReputationRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerReputation" ADD CONSTRAINT "ReviewerReputation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "VerifiedHuman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HederaOrderLedger" ADD CONSTRAINT "HederaOrderLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HcsEvent" ADD CONSTRAINT "HcsEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

