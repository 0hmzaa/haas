import type {
  AuditTimelineResponse,
  DisputeDetail,
  OrderListResponse,
  OrderSummary,
  ProofListResponse,
  ReputationReviewerResponse,
  ReputationWorkerResponse,
  WalletIdentityResponse,
  WorkerListResponse,
  WorkerProfile,
  WorldVerifyResponse
} from "./models";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000";

function toUrl(path: string): string {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toUrl(path), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function queryString(params: Record<string, string | undefined>): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) {
      url.set(key, value);
    }
  }
  const serialized = url.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export async function listWorkers(filters: {
  country?: string;
  city?: string;
  skill?: string;
  availabilityStatus?: string;
  minRating?: string;
}) {
  return request<WorkerListResponse>(
    `/api/workers${queryString({
      country: filters.country,
      city: filters.city,
      skill: filters.skill,
      availabilityStatus: filters.availabilityStatus,
      minRating: filters.minRating
    })}`
  );
}

export async function getWorkerById(workerId: string) {
  return request<WorkerProfile>(`/api/workers/${workerId}`);
}

export async function createWorker(input: {
  verifiedHumanId: string;
  displayName: string;
  bio: string;
  country: string;
  city: string;
  timezone: string;
  skills: string[];
  baseRate: string;
  availabilityStatus: string;
  acceptedProofTypes: string[];
}) {
  return request<WorkerProfile>("/api/workers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateWorker(workerId: string, input: Partial<{
  displayName: string;
  bio: string;
  country: string;
  city: string;
  timezone: string;
  skills: string[];
  baseRate: string;
  availabilityStatus: string;
  acceptedProofTypes: string[];
  reviewerEligible: boolean;
}>) {
  return request<WorkerProfile>(`/api/workers/${workerId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function verifyWorld(input: {
  session_id: string;
  nullifier_hash: string;
  walletAddress: string;
  proof: Record<string, unknown>;
}) {
  return request<WorldVerifyResponse>("/api/world/verify", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getIdentityByWallet(walletAddress: string) {
  return request<WalletIdentityResponse>(
    `/api/world/identity${queryString({ walletAddress })}`
  );
}

export async function createOrder(input: {
  clientId: string;
  clientAccountId?: string;
  workerId: string;
  title: string;
  objective: string;
  instructions: string;
  amount: string;
  currency: string;
  reviewWindowHours?: number;
}) {
  return request<OrderSummary>("/api/orders", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listOrders(filters: {
  workerId?: string;
  clientId?: string;
  clientAccountId?: string;
  reviewerId?: string;
  status?: string;
}) {
  return request<OrderListResponse>(
    `/api/orders${queryString({
      workerId: filters.workerId,
      clientId: filters.clientId,
      clientAccountId: filters.clientAccountId,
      reviewerId: filters.reviewerId,
      status: filters.status
    })}`
  );
}

export async function getOrderById(orderId: string) {
  return request<OrderSummary>(`/api/orders/${orderId}`);
}

export async function startOrder(orderId: string) {
  return request<OrderSummary>(`/api/orders/${orderId}/start`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function createPaymentRequirement(orderId: string) {
  return request<{
    status: string;
    payment: {
      x402PaymentId: string;
      paymentEndpoint: string;
      x402: {
        paymentRequirements: {
          network: string;
          maxAmountRequired: string;
          payTo: string;
          asset: string;
          extra?: Record<string, unknown>;
        };
      };
    };
  }>(`/api/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function submitPayment(orderId: string, input: {
  x402PaymentId: string;
  signedPayload: unknown;
  payerAccount?: string;
}) {
  return request<{
    funded: boolean;
    hederaTxId?: string;
    orderStatus?: string;
  }>(`/api/orders/${orderId}/pay/submit`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function uploadProof(orderId: string, input: {
  file: File;
  summary: string;
}) {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("summary", input.summary);

  const response = await fetch(toUrl(`/api/orders/${orderId}/proof`), {
    method: "POST",
    body: formData
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Proof upload failed: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function getProofs(orderId: string) {
  return request<ProofListResponse>(`/api/orders/${orderId}/proof`);
}

export async function approveOrder(orderId: string, actorId: string) {
  return request<{ orderStatus: string; releaseTxId: string }>(`/api/orders/${orderId}/approve`, {
    method: "POST",
    body: JSON.stringify({ actorId })
  });
}

export async function openDispute(orderId: string, input: {
  reasonCode: string;
  clientStatement: string;
  actorId?: string;
}) {
  return request<{
    id: string;
    orderId: string;
    assignedReviewerIds: string[];
    status: string;
  }>(`/api/orders/${orderId}/dispute`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getDispute(orderId: string) {
  return request<DisputeDetail>(`/api/orders/${orderId}/dispute`);
}

export async function respondDispute(orderId: string, workerStatement: string, actorId?: string) {
  return request(`/api/orders/${orderId}/dispute/respond`, {
    method: "POST",
    body: JSON.stringify({ workerStatement, actorId })
  });
}

export async function voteDispute(orderId: string, input: {
  reviewerId: string;
  vote: "RELEASE_TO_WORKER" | "REFUND_CLIENT" | "SPLIT_PAYMENT";
}) {
  return request<{
    resolved: boolean;
    resolution: string | null;
    orderStatus?: string;
  }>(`/api/orders/${orderId}/dispute/vote`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getAudit(orderId: string) {
  return request<AuditTimelineResponse>(`/api/orders/${orderId}/audit`);
}

export async function getWorkerReputation(workerId: string) {
  return request<ReputationWorkerResponse>(`/api/reputation/workers/${workerId}`);
}

export async function getReviewerReputation(reviewerId: string) {
  return request<ReputationReviewerResponse>(`/api/reputation/reviewers/${reviewerId}`);
}
