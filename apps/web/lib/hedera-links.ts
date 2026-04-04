const HASHSCAN_TESTNET_BASE = "https://hashscan.io/testnet";

export function toHashscanTxUrl(txId: string): string {
  return `${HASHSCAN_TESTNET_BASE}/transaction/${encodeURIComponent(txId)}`;
}

export function toHashscanAccountUrl(accountId: string): string {
  return `${HASHSCAN_TESTNET_BASE}/account/${encodeURIComponent(accountId)}`;
}

export function toHashscanTopicUrl(topicId: string): string {
  return `${HASHSCAN_TESTNET_BASE}/topic/${encodeURIComponent(topicId)}`;
}

export function toMirrorTxUrl(mirrorBaseUrl: string, txId: string): string {
  const normalizedBase = mirrorBaseUrl.replace(/\/+$/, "");
  return `${normalizedBase}/api/v1/transactions/${encodeURIComponent(txId)}`;
}

export function toMirrorTopicUrl(mirrorBaseUrl: string, topicId: string): string {
  const normalizedBase = mirrorBaseUrl.replace(/\/+$/, "");
  return `${normalizedBase}/api/v1/topics/${encodeURIComponent(topicId)}/messages?order=asc`;
}
