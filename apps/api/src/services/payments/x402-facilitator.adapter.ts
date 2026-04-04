import { AppError } from "../../lib/app-error.js";
import { getX402Config } from "../../config/x402.config.js";

export type SubmitSignedPaymentInput = {
  orderId: string;
  x402PaymentId: string;
  signedPayload: unknown;
  signature?: string;
  payerAccount?: string;
  amount: string;
  asset: string;
  recipient: string;
};

export type SubmitSignedPaymentResult = {
  success: boolean;
  hederaTxId?: string;
  facilitatorId?: string;
  payerAccount?: string;
  amount?: string;
  asset?: string;
};

type FacilitatorApiResponse = {
  success?: boolean;
  approved?: boolean;
  status?: string;
  hederaTxId?: string;
  hedera_tx_id?: string;
  transactionId?: string;
  txId?: string;
  facilitatorId?: string;
  facilitator_id?: string;
  payerAccount?: string;
  payer_account?: string;
  amount?: string;
  asset?: string;
  error?: string;
  message?: string;
};

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function resolveTxId(payload: FacilitatorApiResponse): string | undefined {
  return payload.hederaTxId ?? payload.hedera_tx_id ?? payload.transactionId ?? payload.txId;
}

function resolveSuccess(payload: FacilitatorApiResponse): boolean {
  if (typeof payload.success === "boolean") {
    return payload.success;
  }

  if (typeof payload.approved === "boolean") {
    return payload.approved;
  }

  if (typeof payload.status === "string") {
    const normalized = payload.status.toLowerCase();
    return normalized === "success" || normalized === "ok" || normalized === "approved";
  }

  return false;
}

export class X402FacilitatorAdapter {
  private readonly config = getX402Config();

  isConfigured(): boolean {
    return typeof this.config.facilitatorApiBaseUrl === "string";
  }

  async submitSignedPayment(input: SubmitSignedPaymentInput): Promise<SubmitSignedPaymentResult> {
    if (!this.config.facilitatorApiBaseUrl) {
      throw new AppError("X402_FACILITATOR_API_BASE_URL is required for pay submission", 500);
    }

    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== "function") {
      throw new AppError("Global fetch is not available for facilitator submissions", 500);
    }

    const endpoint = joinUrl(
      this.config.facilitatorApiBaseUrl,
      this.config.facilitatorFundingPath
    );
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json"
    };

    if (this.config.facilitatorApiKey) {
      headers.authorization = `Bearer ${this.config.facilitatorApiKey}`;
    }

    let response: Response;
    try {
      response = await fetchFn(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId: input.orderId,
          x402PaymentId: input.x402PaymentId,
          signedPayload: input.signedPayload,
          signature: input.signature,
          payerAccount: input.payerAccount,
          amount: input.amount,
          asset: input.asset,
          recipient: input.recipient
        }),
        signal: AbortSignal.timeout(this.config.facilitatorTimeoutMs)
      });
    } catch {
      throw new AppError("Facilitator is unreachable", 502);
    }

    let payload: FacilitatorApiResponse = {};
    try {
      payload = (await response.json()) as FacilitatorApiResponse;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const reason = payload.error ?? payload.message ?? "Facilitator request failed";
      throw new AppError(reason, 502);
    }

    const success = resolveSuccess(payload);
    if (!success) {
      return {
        success: false,
        facilitatorId: payload.facilitatorId ?? payload.facilitator_id ?? this.config.facilitatorId
      };
    }

    const hederaTxId = resolveTxId(payload);
    if (!hederaTxId || hederaTxId.length === 0) {
      throw new AppError("Facilitator response is missing hederaTxId", 502);
    }

    return {
      success: true,
      hederaTxId,
      facilitatorId: payload.facilitatorId ?? payload.facilitator_id ?? this.config.facilitatorId,
      payerAccount: payload.payerAccount ?? payload.payer_account ?? input.payerAccount,
      amount: payload.amount ?? input.amount,
      asset: payload.asset ?? input.asset
    };
  }
}
