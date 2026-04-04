type StepperProps = {
  steps: string[];
  currentStep: number;
};

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {steps.map((label, index) => {
        const done = index < currentStep;
        const active = index === currentStep;

        return (
          <div key={label} className="flex items-center">
            {index > 0 ? (
              <div
                className={`h-0.5 w-6 sm:w-10 ${done ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
              />
            ) : null}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 text-xs font-bold ${
                  done
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)]"
                    : active
                      ? "border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]"
                }`}
              >
                {done ? "\u2713" : index + 1}
              </div>
              <span
                className={`whitespace-nowrap text-xs font-semibold ${
                  done || active ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
