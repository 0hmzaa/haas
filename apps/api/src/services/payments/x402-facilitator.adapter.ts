import { AppError } from "../../lib/app-error.js";
import { getX402Config } from "../../config/x402.config.js";

export type X402FacilitatorPaymentRequirements = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
};

export type SubmitSignedPaymentInput = {
  orderId: string;
  x402PaymentId: string;
  signedPayload: unknown;
  paymentRequirements: X402FacilitatorPaymentRequirements;
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
  isValid?: boolean;
  approved?: boolean;
  status?: string;
  transaction?: string;
  hederaTxId?: string;
  hedera_tx_id?: string;
  transactionId?: string;
  transaction_id?: string;
  txId?: string;
  txHash?: string;
  facilitatorId?: string;
  facilitator_id?: string;
  payer?: string;
  payerAccount?: string;
  payer_account?: string;
  amount?: string;
  asset?: string;
  error?: string;
  errorReason?: string;
  message?: string;
  details?: {
    txHash?: string;
    transactionId?: string;
    hederaTxId?: string;
  };
};

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function resolveTxId(payload: FacilitatorApiResponse): string | undefined {
  return (
    payload.transaction ??
    payload.hederaTxId ??
    payload.hedera_tx_id ??
    payload.transactionId ??
    payload.transaction_id ??
    payload.txId ??
    payload.txHash ??
    payload.details?.txHash ??
    payload.details?.transactionId ??
    payload.details?.hederaTxId
  );
}

function resolveSuccess(payload: FacilitatorApiResponse): boolean {
  if (typeof payload.isValid === "boolean") {
    return payload.isValid;
  }

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveErrorMessage(payload: FacilitatorApiResponse, fallback: string): string {
  if (typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  if (typeof payload.errorReason === "string" && payload.errorReason.length > 0) {
    return payload.errorReason;
  }

  if (typeof payload.message === "string" && payload.message.length > 0) {
    return payload.message;
  }

  return fallback;
}

function resolveSignedPaymentHeader(signedPayload: unknown): string {
  if (typeof signedPayload === "string" && signedPayload.length > 0) {
    return signedPayload;
  }

  if (!isRecord(signedPayload)) {
    throw new AppError(
      "signedPayload must be a base64 payment header string or an object containing paymentHeader",
      400
    );
  }

  const keyCandidates = [
    "paymentHeader",
    "xPayment",
    "x-payment",
    "header",
    "payment_header",
    "x_payment"
  ];

  for (const key of keyCandidates) {
    const value = signedPayload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  const nested = signedPayload.payment;
  if (isRecord(nested)) {
    const nestedHeader = nested.paymentHeader;
    if (typeof nestedHeader === "string" && nestedHeader.length > 0) {
      return nestedHeader;
    }
  }

  throw new AppError(
    "signedPayload is missing paymentHeader (expected key: paymentHeader)",
    400
  );
}

function toFacilitatorPayload(raw: unknown): FacilitatorApiResponse {
  if (isRecord(raw)) {
    return raw as FacilitatorApiResponse;
  }

  return {};
}

function buildEndpointCandidates(baseUrl: string, path: string): string[] {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates: string[] = [];
  const pushCandidate = (url: string) => {
    if (!candidates.includes(url)) {
      candidates.push(url);
    }
  };

  pushCandidate(joinUrl(normalizedBase, normalizedPath));

  if (normalizedPath.startsWith("/v1/")) {
    pushCandidate(joinUrl(normalizedBase, normalizedPath.replace(/^\/v1/, "")));
  }

  if (/\/v1$/i.test(normalizedBase)) {
    const baseWithoutV1 = normalizedBase.replace(/\/v1$/i, "");
    pushCandidate(joinUrl(baseWithoutV1, normalizedPath));
    if (normalizedPath.startsWith("/v1/")) {
      pushCandidate(joinUrl(baseWithoutV1, normalizedPath.replace(/^\/v1/, "")));
    }
  }

  return candidates;
}

export class X402FacilitatorAdapter {
  private readonly config = getX402Config();

  isConfigured(): boolean {
    return typeof this.config.facilitatorApiBaseUrl === "string";
  }

  private getFetch(): NonNullable<typeof globalThis.fetch> {
    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== "function") {
      throw new AppError("Global fetch is not available for facilitator submissions", 500);
    }

    return fetchFn;
  }

  private buildHeaders(input: { paymentHeader?: string }): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json"
    };

    if (this.config.facilitatorApiKey) {
      headers[this.config.facilitatorApiKeyHeader] = this.config.facilitatorApiKey;
      headers.authorization = `Bearer ${this.config.facilitatorApiKey}`;
    }

    if (input.paymentHeader) {
      headers["x-payment"] = input.paymentHeader;
    }

    return headers;
  }

  private async postJson(
    path: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<{ response: Response; payload: FacilitatorApiResponse }> {
    if (!this.config.facilitatorApiBaseUrl) {
      throw new AppError("X402_FACILITATOR_API_BASE_URL is required for pay submission", 500);
    }

    const fetchFn = this.getFetch();
    const endpoints = buildEndpointCandidates(this.config.facilitatorApiBaseUrl, path);
    let lastResponse: Response | null = null;
    let lastPayload: FacilitatorApiResponse = {};

    for (const endpoint of endpoints) {
      let response: Response;
      try {
        response = await fetchFn(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.facilitatorTimeoutMs)
        });
      } catch {
        throw new AppError("Facilitator is unreachable", 502);
      }

      let payload: FacilitatorApiResponse = {};
      try {
        payload = toFacilitatorPayload(await response.json());
      } catch {
        payload = {};
      }

      if (response.status === 404 && endpoint !== endpoints[endpoints.length - 1]) {
        lastResponse = response;
        lastPayload = payload;
        continue;
      }

      return { response, payload };
    }

    if (!lastResponse) {
      throw new AppError("Facilitator request failed", 502);
    }

    return { response: lastResponse, payload: lastPayload };
  }

  private async submitViaLegacyFundingPath(
    input: SubmitSignedPaymentInput
  ): Promise<SubmitSignedPaymentResult> {
    const headers = this.buildHeaders({});
    const { response, payload } = await this.postJson(
      this.config.facilitatorFundingPath,
      {
        orderId: input.orderId,
        x402PaymentId: input.x402PaymentId,
        signedPayload: input.signedPayload,
        signature: input.signature,
        payerAccount: input.payerAccount,
        amount: input.amount,
        asset: input.asset,
        recipient: input.recipient
      },
      headers
    );

    if (!response.ok) {
      throw new AppError(resolveErrorMessage(payload, "Facilitator request failed"), 502);
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
      payerAccount:
        payload.payerAccount ?? payload.payer_account ?? payload.payer ?? input.payerAccount,
      amount: payload.amount ?? input.amount,
      asset: payload.asset ?? input.asset
    };
  }

  private async submitViaVerifyAndSettle(
    input: SubmitSignedPaymentInput
  ): Promise<SubmitSignedPaymentResult> {
    const paymentHeader = resolveSignedPaymentHeader(input.signedPayload);
    const headers = this.buildHeaders({ paymentHeader });
    const payload = {
      x402Version: 1,
      paymentHeader,
      paymentRequirements: input.paymentRequirements
    };

    const verify = await this.postJson(this.config.facilitatorVerifyPath, payload, headers);
    if (!verify.response.ok) {
      throw new AppError(resolveErrorMessage(verify.payload, "Facilitator verify failed"), 502);
    }

    if (!resolveSuccess(verify.payload)) {
      return {
        success: false,
        facilitatorId:
          verify.payload.facilitatorId ??
          verify.payload.facilitator_id ??
          this.config.facilitatorId
      };
    }

    const settle = await this.postJson(this.config.facilitatorSettlePath, payload, headers);
    if (!settle.response.ok) {
      throw new AppError(resolveErrorMessage(settle.payload, "Facilitator settle failed"), 502);
    }

    if (!resolveSuccess(settle.payload)) {
      return {
        success: false,
        facilitatorId:
          settle.payload.facilitatorId ??
          settle.payload.facilitator_id ??
          this.config.facilitatorId
      };
    }

    const hederaTxId = resolveTxId(settle.payload);
    if (!hederaTxId || hederaTxId.length === 0) {
      throw new AppError("Facilitator settle response is missing transaction id", 502);
    }

    return {
      success: true,
      hederaTxId,
      facilitatorId:
        settle.payload.facilitatorId ??
        settle.payload.facilitator_id ??
        this.config.facilitatorId,
      payerAccount:
        settle.payload.payerAccount ??
        settle.payload.payer_account ??
        settle.payload.payer ??
        input.payerAccount,
      amount: settle.payload.amount ?? input.amount,
      asset: settle.payload.asset ?? input.asset
    };
  }

  async submitSignedPayment(input: SubmitSignedPaymentInput): Promise<SubmitSignedPaymentResult> {
    if (this.config.facilitatorMode === "legacy") {
      return this.submitViaLegacyFundingPath(input);
    }

    return this.submitViaVerifyAndSettle(input);
  }
}
