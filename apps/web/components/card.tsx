import type { ReactNode } from "react";

type CardVariant = "default" | "elevated" | "flat";

type CardProps = {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
};

const variantStyles: Record<CardVariant, string> = {
  default:
    "border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[4px_4px_0_var(--color-border-strong)]",
  elevated:
    "border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[6px_6px_0_var(--color-border-strong)]",
  flat:
    "border-2 border-[var(--color-border)] bg-[var(--color-surface)]",
};

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <section className={`p-5 ${variantStyles[variant]} ${className ?? ""}`}>
      {children}
    </section>
  );
}
