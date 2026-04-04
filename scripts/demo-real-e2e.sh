#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
REAL_ORDER_AMOUNT="${REAL_ORDER_AMOUNT:-20.00}"
REAL_ORDER_CURRENCY="${REAL_ORDER_CURRENCY:-HBAR}"
REAL_CLIENT_ID="${REAL_CLIENT_ID:-client-live}"
WORLD_ID_MODE="${WORLD_ID_MODE:-mock}"
REAL_X402_PAYMENT_HEADER="${REAL_X402_PAYMENT_HEADER:-}"

required_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: ${name}" >&2
    exit 1
  fi
}

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

json_get() {
  local path="$1"
  node -e '
const fs = require("fs");
const path = process.argv[1].split(".");
const data = JSON.parse(fs.readFileSync(0, "utf8"));
let cursor = data;
for (const key of path) {
  cursor = cursor?.[key];
}
if (cursor === undefined) {
  process.exit(2);
}
if (typeof cursor === "object") {
  process.stdout.write(JSON.stringify(cursor));
} else {
  process.stdout.write(String(cursor));
}
' "$path"
}

json_get_or_fail() {
  local path="$1"
  local label="$2"
  local payload="$3"

  local value
  if ! value="$(printf '%s' "${payload}" | json_get "${path}" 2>/dev/null)"; then
    echo "${label} failed: ${payload}" >&2
    exit 1
  fi

  printf '%s' "${value}"
}

post_json() {
  local endpoint="$1"
  local payload="$2"
  curl -fsS -X POST "${API_BASE_URL}${endpoint}" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

post_signed_x402_webhook() {
  local endpoint="$1"
  local payload="$2"
  local timestamp
  timestamp="$(date +%s)"

  local signature
  signature="$(
    node -e '
const crypto = require("node:crypto");
const payload = JSON.parse(process.argv[1]);
const timestamp = process.argv[2];
const facilitatorId = process.argv[3];
const secret = process.argv[4];

const fields = [
  payload.x402PaymentId ?? "",
  payload.orderId ?? "",
  payload.success ? "true" : "false",
  payload.hederaTxId ?? "",
  facilitatorId,
  payload.payerAccount ?? "",
  payload.amount ?? "",
  payload.asset ?? ""
];

const canonical = `${timestamp}.${fields.join("|")}`;
const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
process.stdout.write(`v1=${signature}`);
' "$payload" "$timestamp" "$X402_FACILITATOR_ID" "$X402_FACILITATOR_SIGNING_SECRET"
  )"

  curl -fsS -X POST "${API_BASE_URL}${endpoint}" \
    -H 'Content-Type: application/json' \
    -H "x-x402-facilitator-id: ${X402_FACILITATOR_ID}" \
    -H "x-x402-timestamp: ${timestamp}" \
    -H "x-x402-signature: ${signature}" \
    -d "$payload"
}

required_env WORLD_VERIFY_PAYLOAD_FILE
required_env X402_FACILITATOR_ID
required_env X402_FACILITATOR_SIGNING_SECRET
required_env REAL_PAYER_ACCOUNT

if [[ -z "${REAL_X402_PAYMENT_HEADER}" ]]; then
  required_env REAL_HEDERA_TX_ID
fi

REAL_CLIENT_ACCOUNT="${REAL_CLIENT_ACCOUNT:-${REAL_PAYER_ACCOUNT}}"

if [[ ! -f "${WORLD_VERIFY_PAYLOAD_FILE}" ]]; then
  echo "WORLD_VERIFY_PAYLOAD_FILE not found: ${WORLD_VERIFY_PAYLOAD_FILE}" >&2
  exit 1
fi

WORLD_VERIFY_PAYLOAD="$(cat "${WORLD_VERIFY_PAYLOAD_FILE}")"

node -e '
const payload = JSON.parse(process.argv[1]);
if (typeof payload.session_id !== "string" || payload.session_id.length === 0) {
  throw new Error("session_id is required in world verify payload");
}
if (typeof payload.nullifier_hash !== "string" || payload.nullifier_hash.length === 0) {
  throw new Error("nullifier_hash is required in world verify payload");
}
if (payload.proof === undefined) {
  throw new Error("proof is required in world verify payload");
}
' "${WORLD_VERIFY_PAYLOAD}"

if [[ "${WORLD_ID_MODE}" == "mock" ]]; then
  NONCE="$(date +%s)-$RANDOM"
  WORLD_VERIFY_PAYLOAD="$(
    node -e '
const payload = JSON.parse(process.argv[1]);
const nonce = process.argv[2];

if (typeof payload.session_id !== "string" || payload.session_id.length === 0) {
  payload.session_id = "session-mock-shared";
}

// Keep a stable mock session, but always rotate nullifier to avoid anti-replay failures.
payload.nullifier_hash = `${payload.session_id}-nullifier-${nonce}`;

if (payload.proof === undefined) {
  payload.proof = { valid: true };
}

process.stdout.write(JSON.stringify(payload));
' "${WORLD_VERIFY_PAYLOAD}" "${NONCE}"
  )"
fi

log "Starting REAL E2E run against ${API_BASE_URL}"
log "Expected env: WORLD_ID_MODE=live, HEDERA_ENABLED=true, X402_REQUIRE_SIGNED_WEBHOOK=true"

VERIFY_RESP="$(post_json '/api/world/verify' "${WORLD_VERIFY_PAYLOAD}")"
VERIFIED_HUMAN_ID="$(json_get_or_fail 'verifiedHumanId' 'World verification' "${VERIFY_RESP}")"
log "World verification accepted: verifiedHumanId=${VERIFIED_HUMAN_ID}"

WORKER_RESP="$(
  curl -sS -X POST "${API_BASE_URL}/api/workers" \
    -H 'Content-Type: application/json' \
    -d "{\"verifiedHumanId\":\"${VERIFIED_HUMAN_ID}\",\"displayName\":\"live-worker\",\"skills\":[\"real-world-task\"],\"baseRate\":\"15.00\"}"
)"

if WORKER_ID="$(printf '%s' "${WORKER_RESP}" | json_get 'id' 2>/dev/null)"; then
  log "Worker created: ${WORKER_ID}"
else
  WORKERS_LIST="$(curl -sS "${API_BASE_URL}/api/workers?limit=100&offset=0")"
  WORKER_ID="$(
    node -e '
const payload = JSON.parse(process.argv[1]);
const verifiedHumanId = process.argv[2];
const items = Array.isArray(payload.items) ? payload.items : [];
const existing = items.find((item) => item?.verifiedHumanId === verifiedHumanId);
if (!existing || typeof existing.id !== "string") {
  process.exit(2);
}
process.stdout.write(existing.id);
' "${WORKERS_LIST}" "${VERIFIED_HUMAN_ID}" 2>/dev/null || true
  )"

  if [[ -z "${WORKER_ID}" ]]; then
    echo "Worker creation failed: ${WORKER_RESP}" >&2
    exit 1
  fi

  log "Worker reused: ${WORKER_ID}"
fi

ORDER_RESP="$(
  post_json '/api/orders' \
    "{\"clientId\":\"${REAL_CLIENT_ID}\",\"clientAccountId\":\"${REAL_CLIENT_ACCOUNT}\",\"workerId\":\"${WORKER_ID}\",\"title\":\"Live E2E task\",\"objective\":\"Validate real credential path\",\"instructions\":\"Perform live demo task and submit proof\",\"amount\":\"${REAL_ORDER_AMOUNT}\",\"currency\":\"${REAL_ORDER_CURRENCY}\"}"
)"
ORDER_ID="$(json_get_or_fail 'id' 'Order creation' "${ORDER_RESP}")"
log "Order created: ${ORDER_ID}"

PAY_RESP="$(post_json "/api/orders/${ORDER_ID}/pay" '{}')"
X402_PAYMENT_ID="$(json_get_or_fail 'payment.x402PaymentId' 'Payment requirement creation' "${PAY_RESP}")"
log "Payment requirement created: x402PaymentId=${X402_PAYMENT_ID}"

if [[ -n "${REAL_X402_PAYMENT_HEADER}" ]]; then
  SUBMIT_PAYLOAD="{\"x402PaymentId\":\"${X402_PAYMENT_ID}\",\"signedPayload\":{\"paymentHeader\":\"${REAL_X402_PAYMENT_HEADER}\"},\"payerAccount\":\"${REAL_PAYER_ACCOUNT}\"}"
  SUBMIT_RESP="$(post_json "/api/orders/${ORDER_ID}/pay/submit" "${SUBMIT_PAYLOAD}")"
  SUBMIT_FUNDED="$(json_get_or_fail 'funded' 'Facilitator direct submit' "${SUBMIT_RESP}")"

  if [[ "${SUBMIT_FUNDED}" != "true" ]]; then
    echo "Facilitator direct submit did not fund the order: ${SUBMIT_RESP}" >&2
    exit 1
  fi

  FACILITATOR_TX_ID="$(json_get_or_fail 'hederaTxId' 'Facilitator direct submit tx id' "${SUBMIT_RESP}")"
  log "Facilitator direct submit accepted: hederaTxId=${FACILITATOR_TX_ID}"
else
  FUND_WEBHOOK_PAYLOAD="{\"x402PaymentId\":\"${X402_PAYMENT_ID}\",\"success\":true,\"hederaTxId\":\"${REAL_HEDERA_TX_ID}\",\"facilitatorId\":\"${X402_FACILITATOR_ID}\",\"payerAccount\":\"${REAL_PAYER_ACCOUNT}\",\"amount\":\"${REAL_ORDER_AMOUNT}\",\"asset\":\"${REAL_ORDER_CURRENCY}\"}"
  post_signed_x402_webhook '/api/webhooks/x402' "${FUND_WEBHOOK_PAYLOAD}" >/dev/null
  log "Signed x402 webhook accepted"
fi

post_json "/api/orders/${ORDER_ID}/start" '{}' >/dev/null
log "Order started"

TMP_FILE="$(mktemp /tmp/haas-real-proof-XXXXXX.txt)"
printf 'Live E2E proof captured at %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "${TMP_FILE}"

curl -sS -X POST "${API_BASE_URL}/api/orders/${ORDER_ID}/proof" \
  -F "file=@${TMP_FILE};type=text/plain" \
  -F 'summary=Live E2E proof artifact' >/dev/null

rm -f "${TMP_FILE}"
log "Proof submitted"

post_json "/api/orders/${ORDER_ID}/approve" "{\"actorId\":\"${REAL_CLIENT_ID}\"}" >/dev/null
log "Order approved"

ORDER_FINAL="$(curl -fsS "${API_BASE_URL}/api/orders/${ORDER_ID}")"
ORDER_STATUS="$(json_get_or_fail 'status' 'Order fetch' "${ORDER_FINAL}")"

if [[ "${ORDER_STATUS}" != "APPROVED" ]]; then
  echo "Unexpected final status: ${ORDER_STATUS}" >&2
  exit 1
fi

AUDIT="$(curl -fsS "${API_BASE_URL}/api/orders/${ORDER_ID}/audit")"
TIMELINE_COUNT="$(json_get_or_fail 'timeline.length' 'Audit fetch' "${AUDIT}")"
log "Audit timeline events: ${TIMELINE_COUNT}"

printf '\nREAL E2E completed successfully for order %s\n' "${ORDER_ID}"
