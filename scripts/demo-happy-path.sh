#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
MODE="${1:-approve}"
X402_FACILITATOR_ID="${X402_FACILITATOR_ID:-facilitator-demo}"
X402_FACILITATOR_SIGNING_SECRET="${X402_FACILITATOR_SIGNING_SECRET:-dev-facilitator-secret}"
DEMO_CLIENT_ACCOUNT_ID="${DEMO_CLIENT_ACCOUNT_ID:-0.0.5005}"

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

patch_json() {
  local endpoint="$1"
  local payload="$2"
  curl -fsS -X PATCH "${API_BASE_URL}${endpoint}" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

create_verified_worker() {
  local label="$1"
  local session_id="session-${label}-$(date +%s)-$RANDOM"
  local nullifier_hash="nullifier-${label}-$(date +%s)-$RANDOM"
  local wallet_address="0.0.$((100000 + RANDOM))"

  local verified
  verified="$(post_json '/api/world/verify' "{\"session_id\":\"${session_id}\",\"nullifier_hash\":\"${nullifier_hash}\",\"walletAddress\":\"${wallet_address}\",\"proof\":{\"valid\":true}}")"

  local verified_human_id
  verified_human_id="$(printf '%s' "$verified" | json_get 'verifiedHumanId')"

  local worker
  worker="$(post_json '/api/workers' "{\"verifiedHumanId\":\"${verified_human_id}\",\"displayName\":\"${label}\",\"skills\":[\"local-task\"],\"baseRate\":\"15.00\"}")"

  local worker_id
  worker_id="$(printf '%s' "$worker" | json_get 'id')"

  printf '%s|%s\n' "$verified_human_id" "$worker_id"
}

log "Starting demo flow in mode=${MODE} against ${API_BASE_URL}"

worker_pair="$(create_verified_worker 'worker-main')"
WORKER_VERIFIED_HUMAN_ID="${worker_pair%%|*}"
WORKER_ID="${worker_pair##*|}"
log "Worker created: workerId=${WORKER_ID} verifiedHumanId=${WORKER_VERIFIED_HUMAN_ID}"

REVIEW_WINDOW_SUFFIX=""
if [[ "$MODE" == "auto" ]]; then
  REVIEW_WINDOW_SUFFIX=",\"reviewWindowHours\":0"
fi

ORDER_PAYLOAD="{\"clientId\":\"client-demo\",\"clientAccountId\":\"${DEMO_CLIENT_ACCOUNT_ID}\",\"workerId\":\"${WORKER_ID}\",\"title\":\"Check cafe queue\",\"objective\":\"Measure waiting time\",\"instructions\":\"Go onsite and report queue length\",\"amount\":\"20.00\",\"currency\":\"HBAR\"${REVIEW_WINDOW_SUFFIX}}"
ORDER_RESP="$(post_json '/api/orders' "$ORDER_PAYLOAD")"
ORDER_ID="$(printf '%s' "$ORDER_RESP" | json_get 'id')"
log "Order created: ${ORDER_ID}"

PAY_RESP="$(post_json "/api/orders/${ORDER_ID}/pay" '{}')"
X402_PAYMENT_ID="$(printf '%s' "$PAY_RESP" | json_get 'payment.x402PaymentId')"
log "Payment requirements generated: x402PaymentId=${X402_PAYMENT_ID}"

FUND_WEBHOOK_PAYLOAD="{\"x402PaymentId\":\"${X402_PAYMENT_ID}\",\"success\":true,\"hederaTxId\":\"0.0.demo-$(date +%s)\",\"facilitatorId\":\"${X402_FACILITATOR_ID}\",\"payerAccount\":\"${DEMO_CLIENT_ACCOUNT_ID}\",\"amount\":\"20.00\",\"asset\":\"HBAR\"}"
post_signed_x402_webhook '/api/webhooks/x402' "$FUND_WEBHOOK_PAYLOAD" >/dev/null
log "Funding webhook processed"

post_json "/api/orders/${ORDER_ID}/start" '{}' >/dev/null
log "Order started"

TMP_FILE="$(mktemp /tmp/haas-proof-XXXXXX.txt)"
printf 'Queue length observed: 7 people.\nCaptured at %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$TMP_FILE"

curl -fsS -X POST "${API_BASE_URL}/api/orders/${ORDER_ID}/proof" \
  -F "file=@${TMP_FILE};type=text/plain" \
  -F 'summary=Queue measurement delivered' >/dev/null

rm -f "$TMP_FILE"
log "Proof submitted"

case "$MODE" in
  approve)
    post_json "/api/orders/${ORDER_ID}/approve" '{"actorId":"client-demo"}' >/dev/null
    log "Order approved"
    ;;
  dispute)
    log "Preparing three eligible reviewers"
    declare -a REVIEWER_IDS=()
    for idx in 1 2 3; do
      pair="$(create_verified_worker "reviewer-${idx}")"
      reviewer_verified_human_id="${pair%%|*}"
      reviewer_worker_id="${pair##*|}"
      patch_json "/api/workers/${reviewer_worker_id}" '{"reviewerEligible":true}' >/dev/null
      REVIEWER_IDS+=("${reviewer_verified_human_id}")
    done

    DISPUTE_RESP="$(post_json "/api/orders/${ORDER_ID}/dispute" '{"reasonCode":"PROOF_INSUFFICIENT","clientStatement":"Need reviewer decision"}')"
    ASSIGNED_1="$(printf '%s' "$DISPUTE_RESP" | json_get 'assignedReviewerIds.0')"
    ASSIGNED_2="$(printf '%s' "$DISPUTE_RESP" | json_get 'assignedReviewerIds.1')"

    post_json "/api/orders/${ORDER_ID}/dispute/vote" "{\"reviewerId\":\"${ASSIGNED_1}\",\"vote\":\"RELEASE_TO_WORKER\"}" >/dev/null
    post_json "/api/orders/${ORDER_ID}/dispute/vote" "{\"reviewerId\":\"${ASSIGNED_2}\",\"vote\":\"RELEASE_TO_WORKER\"}" >/dev/null
    log "Dispute opened and majority vote submitted"
    ;;
  auto)
    AUTO_RELEASE_WEBHOOK_PAYLOAD="{\"orderId\":\"${ORDER_ID}\",\"txType\":\"RELEASE\",\"txId\":\"0.0.auto-$(date +%s)\",\"status\":\"SUCCESS\"}"
    post_json '/api/webhooks/hedera' "$AUTO_RELEASE_WEBHOOK_PAYLOAD" >/dev/null
    log "Auto-release mode selected: timeout release webhook simulated"
    ;;
  *)
    echo "Unknown mode: ${MODE}. Use approve|dispute|auto" >&2
    exit 1
    ;;
esac

ORDER_FINAL="$(curl -fsS "${API_BASE_URL}/api/orders/${ORDER_ID}")"
ORDER_STATUS="$(printf '%s' "$ORDER_FINAL" | json_get 'status')"
log "Final order status: ${ORDER_STATUS}"

AUDIT="$(curl -fsS "${API_BASE_URL}/api/orders/${ORDER_ID}/audit")"
TIMELINE_COUNT="$(printf '%s' "$AUDIT" | json_get 'timeline.length')"
log "Audit timeline events: ${TIMELINE_COUNT}"

printf '\nDemo completed successfully for order %s in mode=%s\n' "$ORDER_ID" "$MODE"
