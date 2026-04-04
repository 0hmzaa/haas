import { getPolicyConfig } from "../../config/policy.config.js";

export type TaskPolicyDecision =
  | "ALLOWED"
  | "ALLOWED_WITH_WARNING"
  | "MANUAL_REVIEW"
  | "REJECTED";

export type TaskPolicyEvaluation = {
  decision: TaskPolicyDecision;
  reasons: string[];
};

type Rule = {
  pattern: RegExp;
  reason: string;
};

const REJECT_RULES: Rule[] = [
  { pattern: /\b(steal|theft|fraud|scam|counterfeit)\b/i, reason: "illegal_activity" },
  { pattern: /\b(hack|ddos|malware|phishing)\b/i, reason: "cyber_abuse" },
  { pattern: /\b(kill|assault|weapon|bomb)\b/i, reason: "physical_harm" },
  { pattern: /\b(harass|stalk|blackmail|extort)\b/i, reason: "coercion_or_abuse" },
  { pattern: /\b(fake id|impersonat(e|ion)|forg(e|ery))\b/i, reason: "impersonation" }
];

const MANUAL_REVIEW_RULES: Rule[] = [
  { pattern: /\b(surveillance|spy|track someone)\b/i, reason: "surveillance_risk" },
  { pattern: /\b(medical|medicine|diagnosis|prescription)\b/i, reason: "regulated_work" },
  { pattern: /\b(legal advice|court filing|notary)\b/i, reason: "legal_regulated_work" },
  { pattern: /\b(child|minor)\b/i, reason: "minor_safety" },
  { pattern: /\b(cash pickup|cash delivery|cash transfer)\b/i, reason: "money_handling_risk" }
];

const WARNING_RULES: Rule[] = [
  { pattern: /\b(night|late-night|after midnight)\b/i, reason: "late_hour_safety" },
  { pattern: /\b(remote area|isolated area)\b/i, reason: "location_safety" },
  { pattern: /\b(recording|filming strangers)\b/i, reason: "privacy_warning" }
];

function collectReasons(input: string, rules: Rule[]): string[] {
  const reasons: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(input)) {
      reasons.push(rule.reason);
    }
  }

  return reasons;
}

export class TaskPolicyService {
  private readonly config = getPolicyConfig();

  evaluate(input: { title: string; objective: string; instructions: string }): TaskPolicyEvaluation {
    if (this.config.mode === "off") {
      return {
        decision: "ALLOWED",
        reasons: []
      };
    }

    const normalizedText = `${input.title}\n${input.objective}\n${input.instructions}`;

    const rejectReasons = collectReasons(normalizedText, REJECT_RULES);
    if (rejectReasons.length > 0) {
      if (this.config.mode === "warn") {
        return {
          decision: "ALLOWED_WITH_WARNING",
          reasons: rejectReasons
        };
      }

      return {
        decision: "REJECTED",
        reasons: rejectReasons
      };
    }

    const manualReasons = collectReasons(normalizedText, MANUAL_REVIEW_RULES);
    if (manualReasons.length > 0) {
      if (this.config.mode === "warn") {
        return {
          decision: "ALLOWED_WITH_WARNING",
          reasons: manualReasons
        };
      }

      return {
        decision: "MANUAL_REVIEW",
        reasons: manualReasons
      };
    }

    const warningReasons = collectReasons(normalizedText, WARNING_RULES);
    if (warningReasons.length > 0) {
      return {
        decision: "ALLOWED_WITH_WARNING",
        reasons: warningReasons
      };
    }

    return {
      decision: "ALLOWED",
      reasons: []
    };
  }
}
