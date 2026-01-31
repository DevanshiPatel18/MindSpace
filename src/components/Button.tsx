import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<"primary" | "secondary" | "ghost" | "danger", string> = {
    primary: "bg-black text-white hover:bg-neutral-800 shadow-sm",
    secondary: "bg-white text-neutral-900 hover:bg-neutral-50 border border-neutral-200 shadow-sm",
    ghost: "bg-transparent text-neutral-900 hover:bg-neutral-100",
    danger: "bg-red-600 text-white hover:bg-red-500 shadow-sm",
  };

  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}