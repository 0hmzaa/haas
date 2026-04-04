export type TaskPolicyMode = "enforce" | "warn" | "off";

export type PolicyConfig = {
  mode: TaskPolicyMode;
};

export function getPolicyConfig(): PolicyConfig {
  const modeRaw = process.env.TASK_POLICY_MODE?.toLowerCase();
  const mode: TaskPolicyMode =
    modeRaw === "off" || modeRaw === "warn" || modeRaw === "enforce"
      ? modeRaw
      : "enforce";

  return {
    mode
  };
}
