import {
  AccountId,
  Client,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
  Transaction,
  TransferTransaction,
  Hbar,
  Timestamp,
  ScheduleCreateTransaction,
  ScheduleDeleteTransaction,
  ScheduleId,
  Status
} from "@hashgraph/sdk";
import { AppError } from "../../lib/app-error.js";
import { getHederaConfig, type HederaConfig } from "../../config/hedera.config.js";

export type HcsPublishResult = {
  txId: string;
  topicId: string;
};

export type CreateScheduledReleaseInput = {
  receiverAccountId: string;
  amountHbar: string;
  executeAt: Date;
  memo?: string;
};

export type CreateScheduledReleaseResult = {
  scheduleId: string;
  txId: string;
};

function dateToTimestamp(date: Date): Timestamp {
  const milliseconds = date.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const nanos = (milliseconds % 1000) * 1_000_000;
  return new Timestamp(seconds, nanos);
}

function ensureRuntimeConfig(config: HederaConfig): {
  operatorAccountId: string;
  operatorPrivateKey: string;
} {
  if (!config.enabled) {
    throw new AppError("Hedera runtime is disabled", 503);
  }

  if (!config.operatorAccountId || !config.operatorPrivateKey) {
    throw new AppError(
      "HEDERA_OPERATOR_ACCOUNT_ID and HEDERA_OPERATOR_PRIVATE_KEY are required",
      500
    );
  }

  return {
    operatorAccountId: config.operatorAccountId,
    operatorPrivateKey: config.operatorPrivateKey
  };
}

export class HederaRuntimeService {
  private readonly config = getHederaConfig();

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): HederaConfig {
    return this.config;
  }

  createClient(): Client {
    const runtime = ensureRuntimeConfig(this.config);

    const client =
      this.config.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

    client.setOperator(runtime.operatorAccountId, runtime.operatorPrivateKey);
    return client;
  }

  async submitHcsMessage(message: Record<string, unknown>): Promise<HcsPublishResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    ensureRuntimeConfig(this.config);
    if (!this.config.hcsTopicId) {
      throw new AppError("HEDERA_HCS_TOPIC_ID is required when Hedera is enabled", 500);
    }

    const client = this.createClient();

    const topicId = TopicId.fromString(this.config.hcsTopicId);
    const payload = Buffer.from(JSON.stringify(message));

    const tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(payload);
    const response = await tx.execute(client);

    return {
      txId: response.transactionId.toString(),
      topicId: this.config.hcsTopicId
    };
  }

  async createScheduledRelease(
    input: CreateScheduledReleaseInput
  ): Promise<CreateScheduledReleaseResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    const runtime = ensureRuntimeConfig(this.config);

    if (!this.config.scheduleAdminKey) {
      throw new AppError(
        "HEDERA_SCHEDULE_ADMIN_KEY is required when Hedera is enabled",
        500
      );
    }

    const payerAccountId =
      this.config.defaultEscrowAccountId ?? runtime.operatorAccountId;

    const client = this.createClient();

    const scheduledTransfer = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(payerAccountId), Hbar.fromString(`-${input.amountHbar}`))
      .addHbarTransfer(
        AccountId.fromString(input.receiverAccountId),
        Hbar.fromString(input.amountHbar)
      )
      .freezeWith(client);

    const adminKey = PrivateKey.fromString(this.config.scheduleAdminKey);

    const scheduleCreateTx = await new ScheduleCreateTransaction()
      .setScheduledTransaction(scheduledTransfer as unknown as Transaction)
      .setAdminKey(adminKey)
      .setScheduleMemo(input.memo ?? "haas.auto-release")
      .setWaitForExpiry(true)
      .setExpirationTime(dateToTimestamp(input.executeAt))
      .freezeWith(client)
      .sign(adminKey);

    const response = await scheduleCreateTx.execute(client);
    const receipt = await response.getReceipt(client);

    if (!receipt.scheduleId) {
      throw new AppError("Failed to create Hedera schedule", 500);
    }

    return {
      scheduleId: receipt.scheduleId.toString(),
      txId: response.transactionId.toString()
    };
  }

  async deleteSchedule(scheduleId: string): Promise<{ txId: string } | null> {
    if (!this.config.enabled) {
      return null;
    }

    if (!this.config.scheduleAdminKey) {
      throw new AppError(
        "HEDERA_SCHEDULE_ADMIN_KEY is required when Hedera is enabled",
        500
      );
    }

    const client = this.createClient();
    const adminKey = PrivateKey.fromString(this.config.scheduleAdminKey);

    const tx = await new ScheduleDeleteTransaction()
      .setScheduleId(ScheduleId.fromString(scheduleId))
      .freezeWith(client)
      .sign(adminKey);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    if (receipt.status !== Status.Success) {
      throw new AppError(`Failed to delete schedule ${scheduleId}`, 500);
    }

    return {
      txId: response.transactionId.toString()
    };
  }
}
