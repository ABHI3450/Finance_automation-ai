"use client";

import * as React from "react";

type InputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    icon?: React.ReactNode;
    endIcon?: React.ReactNode;
  };

export default function Input({
  icon,
  endIcon,
  className = "",
  ...props
}: InputProps) {
  return (
    <div
      className="
        group
        flex
        items-center
        gap-3
        rounded-2xl
        border
        border-white/10
        bg-white/[0.05]
        px-4
        py-4
        backdrop-blur-xl
        transition-all
        duration-300
        hover:border-violet-400/40
        focus-within:border-violet-400
        focus-within:shadow-[0_0_35px_rgba(124,58,237,.25)]
      "
    >
      {icon && (
        <span
          className="
            text-white/50
            group-focus-within:text-violet-300
          "
        >
          {icon}
        </span>
      )}

      <input
        {...props}
        className={`
          w-full
          bg-transparent
          text-white
          placeholder:text-white/35
          outline-none
          ${className}
        `}
      />

      {endIcon && (
        <span
          className="
            cursor-pointer
            text-white/40
            transition
            hover:text-white
          "
        >
          {endIcon}
        </span>
      )}
    </div>
  );
}
