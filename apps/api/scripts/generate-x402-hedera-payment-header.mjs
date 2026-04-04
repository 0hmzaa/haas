import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TokenId,
  TransactionId,
  TransferTransaction
} from "@hashgraph/sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--requirements-file" && next) {
      args.requirementsFile = next;
      i += 1;
      continue;
    }

    if (token === "--payer-account" && next) {
      args.payerAccount = next;
      i += 1;
      continue;
    }

    if (token === "--payer-private-key" && next) {
      args.payerPrivateKey = next;
      i += 1;
      continue;
    }
  }

  if (!args.requirementsFile || !args.payerAccount || !args.payerPrivateKey) {
    throw new Error(
      "Missing required args. Usage: --requirements-file <path> --payer-account <0.0.x> --payer-private-key <key>"
    );
  }

  return args;
}

function stripHexPrefix(value) {
  return value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
}

function parsePrivateKey(rawInput) {
  const raw = rawInput.trim();
  const withoutHexPrefix = stripHexPrefix(raw);
  const isRawHex = /^[a-fA-F0-9]{64}$/.test(withoutHexPrefix);

  if (isRawHex) {
    try {
      return PrivateKey.fromStringECDSA(withoutHexPrefix);
    } catch {
      return PrivateKey.fromStringED25519(withoutHexPrefix);
    }
  }

  return PrivateKey.fromString(raw);
}

function parseRequirements(pathToFile) {
  const absolutePath = resolve(pathToFile);
  const raw = readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  if (parsed.scheme !== "exact") {
    throw new Error("paymentRequirements.scheme must be exact");
  }

  if (typeof parsed.network !== "string" || parsed.network.length === 0) {
    throw new Error("paymentRequirements.network is required");
  }

  if (!parsed.network.toLowerCase().startsWith("hedera")) {
    throw new Error(
      `paymentRequirements.network must be Hedera-compatible (received: ${parsed.network})`
    );
  }

  if (typeof parsed.maxAmountRequired !== "string" || parsed.maxAmountRequired.length === 0) {
    throw new Error("paymentRequirements.maxAmountRequired is required");
  }

  if (typeof parsed.payTo !== "string" || parsed.payTo.length === 0) {
    throw new Error("paymentRequirements.payTo is required");
  }

  if (typeof parsed.asset !== "string" || parsed.asset.length === 0) {
    throw new Error("paymentRequirements.asset is required");
  }

  if (!parsed.extra?.feePayer || parsed.extra.feePayer.length === 0) {
    throw new Error(
      "paymentRequirements.extra.feePayer is required for Hedera direct submit"
    );
  }

  return parsed;
}

function tinybarsToHbar(tinybars) {
  if (tinybars < 0n) {
    throw new Error("tinybars cannot be negative");
  }

  const divisor = 100_000_000n;
  const whole = tinybars / divisor;
  const fraction = tinybars % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionPadded = fraction.toString().padStart(8, "0");
  const trimmed = fractionPadded.replace(/0+$/, "");
  return `${whole.toString()}.${trimmed}`;
}

function parseAtomicAmount(raw) {
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      "paymentRequirements.maxAmountRequired must be an integer atomic amount for Hedera"
    );
  }

  return BigInt(raw);
}

function isHbarAsset(asset) {
  return asset === "0.0.0" || asset.toUpperCase() === "HBAR";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requirements = parseRequirements(args.requirementsFile);

  const payerAccountId = AccountId.fromString(args.payerAccount);
  const payToAccountId = AccountId.fromString(requirements.payTo);
  const feePayerAccountId = AccountId.fromString(requirements.extra.feePayer);
  const payerPrivateKey = parsePrivateKey(args.payerPrivateKey);

  const isMainnet = requirements.network.toLowerCase().includes("mainnet");
  const client = isMainnet ? Client.forMainnet() : Client.forTestnet();
  try {
    const atomicAmount = parseAtomicAmount(requirements.maxAmountRequired);

    const tx = new TransferTransaction().setTransactionId(
      TransactionId.generate(feePayerAccountId)
    );

    if (isHbarAsset(requirements.asset)) {
      const amountHbar = tinybarsToHbar(atomicAmount);
      tx
        .addHbarTransfer(payerAccountId, Hbar.fromString(`-${amountHbar}`))
        .addHbarTransfer(payToAccountId, Hbar.fromString(amountHbar));
    } else {
      const tokenId = TokenId.fromString(requirements.asset);

      if (atomicAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(
          "Token atomic amount exceeds Number.MAX_SAFE_INTEGER. This helper currently supports hackathon-safe ranges only."
        );
      }

      const amountAsNumber = Number(atomicAmount);
      tx
        .addTokenTransfer(tokenId, payerAccountId, -amountAsNumber)
        .addTokenTransfer(tokenId, payToAccountId, amountAsNumber);
    }

    await tx.freezeWith(client);
    const signedTx = await tx.sign(payerPrivateKey);

    const paymentPayload = {
      x402Version: 1,
      scheme: requirements.scheme,
      network: requirements.network,
      payload: {
        transaction: Buffer.from(signedTx.toBytes()).toString("base64")
      }
    };

    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
    process.stdout.write(paymentHeader);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[x402-hedera-header] ${message}`);
  process.exit(1);
});
