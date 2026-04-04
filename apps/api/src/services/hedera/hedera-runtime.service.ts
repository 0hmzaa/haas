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
import { hbarToTinybars, isHederaAccountId, tinybarsToHbar } from "../../lib/hbar.js";
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

export type HederaTransferRecipient = {
  accountId: string;
  amountHbar: string;
};

export type ExecuteHbarTransferInput = {
  transfers: HederaTransferRecipient[];
  memo?: string;
};

export type ExecuteHbarTransferResult = {
  txId: string;
};

function dateToTimestamp(date: Date): Timestamp {
  const milliseconds = date.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const nanos = (milliseconds % 1000) * 1_000_000;
  return new Timestamp(seconds, nanos);
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
}

function isRawHexPrivateKey(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(stripHexPrefix(value));
}

function parseHederaPrivateKey(input: {
  value: string;
  type: "auto" | "ecdsa" | "ed25519";
  envName: string;
}): PrivateKey {
  const raw = input.value.trim();

  const parseAsEcdsa = () => PrivateKey.fromStringECDSA(raw);
  const parseAsEd25519 = () => PrivateKey.fromStringED25519(raw);
  const parseAsDefault = () => PrivateKey.fromString(raw);

  try {
    if (input.type === "ecdsa") {
      return parseAsEcdsa();
    }

    if (input.type === "ed25519") {
      return parseAsEd25519();
    }

    if (isRawHexPrivateKey(raw)) {
      // Hex private keys are often ECDSA in Hedera + EVM hackathon setups.
      // We still keep ED25519 fallback for compatibility.
      try {
        return parseAsEcdsa();
      } catch {
        return parseAsEd25519();
      }
    }

    return parseAsDefault();
  } catch {
    throw new AppError(
      `Invalid ${input.envName}. Provide a valid Hedera private key and optional key type override.`,
      500
    );
  }
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

    const operatorPrivateKey = parseHederaPrivateKey({
      value: runtime.operatorPrivateKey,
      type: this.config.operatorPrivateKeyType,
      envName: "HEDERA_OPERATOR_PRIVATE_KEY"
    });

    client.setOperator(runtime.operatorAccountId, operatorPrivateKey);
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
      .addHbarTransfer(
        AccountId.fromString(payerAccountId),
        Hbar.fromString(`-${input.amountHbar}`)
      )
      .addHbarTransfer(
        AccountId.fromString(input.receiverAccountId),
        Hbar.fromString(input.amountHbar)
      );

    const adminKey = parseHederaPrivateKey({
      value: this.config.scheduleAdminKey,
      type: this.config.scheduleAdminKeyType,
      envName: "HEDERA_SCHEDULE_ADMIN_KEY"
    });

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

  async executeHbarTransfer(
    input: ExecuteHbarTransferInput
  ): Promise<ExecuteHbarTransferResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    const runtime = ensureRuntimeConfig(this.config);

    if (input.transfers.length === 0) {
      throw new AppError("At least one transfer recipient is required", 400);
    }

    const payerAccountId =
      this.config.defaultEscrowAccountId ?? runtime.operatorAccountId;

    if (!isHederaAccountId(payerAccountId)) {
      throw new AppError(
        "HEDERA_ESCROW_ACCOUNT_ID must be a valid Hedera account id (for example 0.0.1234)",
        500
      );
    }

    const client = this.createClient();
    const transferTx = new TransferTransaction().setTransactionMemo(
      input.memo ?? "haas.settlement"
    );

    let totalTinybars = 0n;

    for (const transfer of input.transfers) {
      if (!isHederaAccountId(transfer.accountId)) {
        throw new AppError(
          "Transfer receiver account must be a Hedera account id (for example 0.0.1234)",
          409
        );
      }

      const tinybars = hbarToTinybars(transfer.amountHbar);
      if (tinybars <= 0n) {
        throw new AppError("Transfer amount must be greater than zero", 409);
      }

      totalTinybars += tinybars;
      transferTx.addHbarTransfer(
        AccountId.fromString(transfer.accountId),
        Hbar.fromString(tinybarsToHbar(tinybars))
      );
    }

    transferTx.addHbarTransfer(
      AccountId.fromString(payerAccountId),
      Hbar.fromString(`-${tinybarsToHbar(totalTinybars)}`)
    );

    const response = await transferTx.execute(client);
    const receipt = await response.getReceipt(client);

    if (receipt.status !== Status.Success) {
      throw new AppError("Hedera transfer failed", 500);
    }

    return {
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
    const adminKey = parseHederaPrivateKey({
      value: this.config.scheduleAdminKey,
      type: this.config.scheduleAdminKeyType,
      envName: "HEDERA_SCHEDULE_ADMIN_KEY"
    });

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
