import { cn } from "@/lib/cn";

export interface LoadingProps {
  message?: string;
  variant?: "page" | "inline" | "overlay";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

const variantClasses = {
  page: "min-h-screen flex flex-col items-center justify-center gap-3",
  inline: "min-h-[40vh] flex flex-col items-center justify-center gap-3",
  overlay: "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/80",
};

export default function Loading({
  message = "Loading…",
  variant = "inline",
  size = "md",
  className,
}: LoadingProps) {
  return (
    <div className={cn(variantClasses[variant], className)} role="status" aria-live="polite">
      <div
        className={cn(
          "animate-spin rounded-full border-teal-700 border-t-transparent",
          sizeClasses[size],
        )}
        aria-hidden
      />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
