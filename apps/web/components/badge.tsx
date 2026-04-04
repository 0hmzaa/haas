import type { ReactNode } from "react";

type BadgeVariant = "default" | "outline" | "filled" | "success" | "warning" | "danger";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]",
  outline:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-muted)]",
  filled:
    "border-2 border-[var(--color-border-strong)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)]",
  success:
    "border-2 border-[var(--color-success)] bg-[var(--color-surface)] text-[var(--color-success)]",
  warning:
    "border-2 border-[var(--color-warning)] bg-[var(--color-surface)] text-[var(--color-warning)]",
  danger:
    "border-2 border-[var(--color-danger)] bg-[var(--color-surface)] text-[var(--color-danger)]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold ${variantStyles[variant]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
