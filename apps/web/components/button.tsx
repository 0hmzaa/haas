import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-contrast)] border-2 border-[var(--color-border-strong)] shadow-[3px_3px_0_var(--color-border-strong)] hover:shadow-[1px_1px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-text)] border-2 border-[var(--color-border-strong)] shadow-[3px_3px_0_var(--color-border-strong)] hover:shadow-[1px_1px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
  ghost:
    "bg-transparent text-[var(--color-text)] border-2 border-transparent hover:border-[var(--color-border)] underline-offset-4 hover:underline",
  danger:
    "bg-[var(--color-surface)] text-[var(--color-danger)] border-2 border-[var(--color-danger)] shadow-[3px_3px_0_var(--color-danger)] hover:shadow-[1px_1px_0_var(--color-danger)] hover:translate-x-[2px] hover:translate-y-[2px]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
