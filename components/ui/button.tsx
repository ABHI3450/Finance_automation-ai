"use client";

import * as React from "react";

type ButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`
        relative
        w-full
        overflow-hidden
        rounded-2xl
        bg-gradient-to-r
        from-violet-600
        via-indigo-600
        to-blue-600
        px-6
        py-4
        font-semibold
        text-white
        shadow-lg
        shadow-violet-600/25
        transition-all
        duration-300
        hover:scale-[1.02]
        hover:shadow-violet-500/50
        active:scale-[0.98]
        ${className}
      `}
    >
      <span
        className="
          absolute
          inset-0
          bg-white/10
          opacity-0
          transition-opacity
          duration-300
          hover:opacity-100
        "
      />

      <span className="relative z-10">
        {children}
      </span>
    </button>
  );
}
