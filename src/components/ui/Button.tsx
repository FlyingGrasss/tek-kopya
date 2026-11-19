"use client";

import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-colors disabled:pointer-events-none disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]",
  secondary:
    "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--soft)]",
  ghost:
    "border-transparent bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--soft)] hover:text-[color:var(--text)]",
  danger:
    "border-transparent bg-[color:var(--danger)] text-white hover:brightness-105",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={[base, variants[variant], sizes[size], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Spinner label="İşleniyor" /> : null}
      {children}
    </button>
  );
}
