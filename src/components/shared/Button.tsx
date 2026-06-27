import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ children, variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "secondary" | "text" }) {
  return <button className={`${variant === "text" ? "text-button" : `button button-${variant}`} ${className}`.trim()} {...props}>{children}</button>;
}
