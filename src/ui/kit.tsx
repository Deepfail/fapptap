// UI Kit - Reusable components with Radix UI color system and neon styling
import React from "react";

export function Button({
  children,
  variant = "accent",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "accent" | "ok" | "ghost" | "neon" | "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const baseClass =
    "focus-ring transition-all duration-200 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm rounded-md",
    md: "px-4 py-2 text-sm rounded-md",
    lg: "px-6 py-3 text-base rounded-lg",
  };

  // Support both legacy and new variants
  let variantClass = "";
  if (variant === "accent") {
    variantClass = "btn btn-accent"; // Legacy compatibility
  } else if (variant === "ok") {
    variantClass = "btn btn-ok"; // Legacy compatibility
  } else if (variant === "ghost") {
    variantClass = "btn btn-outline"; // Legacy compatibility
  } else if (variant === "neon") {
    variantClass = "btn-neon";
  } else if (variant === "primary") {
    variantClass =
      "bg-accent-9 text-accent-contrast hover:bg-accent-10 shadow-sm";
  } else if (variant === "secondary") {
    variantClass =
      "bg-neutral-3 text-fg hover:bg-neutral-4 border border-neutral-6 hover:border-neutral-7";
  }

  return (
    <button
      {...props}
      className={`${baseClass} ${sizeClasses[size]} ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

export const Panel: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "dark" | "ghost" | "elevated" | "inset";
  }
> = ({ variant = "default", className = "", ...props }) => {
  const baseClass = "rounded-lg transition-all duration-200";

  let variantClass = "";
  if (variant === "default" || variant === "dark") {
    variantClass = "panel"; // Legacy compatibility
  } else if (variant === "ghost") {
    variantClass = "bg-neutral-1 border border-neutral-4";
  } else if (variant === "elevated") {
    variantClass = "panel-dark"; // Use enhanced panel with depth
  } else if (variant === "inset") {
    variantClass = "bg-neutral-2 border border-neutral-5 shadow-inner";
  }

  return (
    <div {...props} className={`${baseClass} ${variantClass} ${className}`} />
  );
};

export const Chip: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    variant?:
      | "default"
      | "accent"
      | "secondary"
      | "success"
      | "warning"
      | "neutral";
    size?: "sm" | "md";
  }
> = ({ variant = "default", size = "md", className = "", ...props }) => {
  const baseClass =
    "inline-flex items-center font-medium transition-all duration-200 cursor-default";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs rounded-full",
    md: "px-3 py-1.5 text-sm rounded-full",
  };

  let variantClass = "";
  if (variant === "default") {
    variantClass = "chip"; // Legacy compatibility
  } else if (variant === "accent") {
    variantClass = "chip-accent";
  } else if (variant === "secondary") {
    variantClass =
      "bg-accent-secondary-3 text-accent-secondary-11 border border-accent-secondary-6 hover:bg-accent-secondary-4";
  } else if (variant === "success") {
    variantClass =
      "bg-green-3 text-green-11 border border-green-6 hover:bg-green-4";
  } else if (variant === "warning") {
    variantClass =
      "bg-amber-3 text-amber-11 border border-amber-6 hover:bg-amber-4";
  } else if (variant === "neutral") {
    variantClass =
      "bg-neutral-3 text-neutral-11 border border-neutral-6 hover:bg-neutral-4";
  }

  return (
    <div
      {...props}
      className={`${baseClass} ${sizeClasses[size]} ${variantClass} ${className}`}
    />
  );
};

export const SectionLabel: React.FC<{
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "muted";
}> = ({ children, variant = "secondary" }) => {
  const variantClasses = {
    primary: "text-fg font-semibold",
    secondary: "text-fg-secondary font-medium",
    muted: "text-neutral-11 font-medium",
  };

  return (
    <div
      className={`text-xs uppercase tracking-wide ${variantClasses[variant]}`}
    >
      {children}
    </div>
  );
};

export const Badge: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: "default" | "accent" | "success" | "warning" | "error";
  }
> = ({ variant = "default", className = "", ...props }) => {
  const baseClass =
    "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full";

  const variantClasses = {
    default: "bg-neutral-3 text-neutral-11 border border-neutral-6",
    accent: "bg-accent-9 text-accent-contrast shadow-sm",
    success: "bg-green-9 text-white shadow-sm",
    warning: "bg-amber-9 text-amber-contrast shadow-sm",
    error: "bg-red-9 text-white shadow-sm",
  };

  return (
    <span
      {...props}
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
    />
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = "",
  ...props
}) => {
  return (
    <input
      {...props}
      className={`
        px-3 py-2 
        bg-neutral-2 
        border border-neutral-6 
        rounded-md 
        text-fg 
        placeholder:text-neutral-11
        focus:outline-none 
        focus:ring-2 
        focus:ring-accent-8 
        focus:border-transparent
        disabled:opacity-50 
        disabled:cursor-not-allowed
        transition-all duration-200
        ${className}
      `}
    />
  );
};
