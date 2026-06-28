import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "onDark" | "onDarkGhost";
type Size = "md" | "lg";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  ariaLabel?: string;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
  secondary:
    "bg-surface text-deep border border-line hover:border-mist hover:bg-ice-soft",
  ghost: "text-deep hover:bg-ice-soft",
  onDark: "bg-surface text-deep hover:bg-ice",
  onDarkGhost: "text-white hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-[0.95rem]",
};

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  onClick,
  ariaLabel,
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    const external = /^(https?:|mailto:|tel:)/.test(href);
    if (external) {
      return (
        <a
          href={href}
          className={classes}
          aria-label={ariaLabel}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={classes}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
