import { cn } from "@/lib/cn";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
type AvatarVariant = "default" | "secondary" | "gradient" | "error";

const sizes: Record<AvatarSize, string> = {
  xs: "w-5 h-5 text-[10px] rounded-full",
  sm: "w-8 h-8 text-xs rounded-xl",
  md: "w-9 h-9 text-sm rounded-xl",
  lg: "w-12 h-12 text-lg rounded-2xl",
  xl: "w-14 h-14 text-lg rounded-2xl",
};

const variants: Record<AvatarVariant, string> = {
  default: "bg-surface-container-high text-primary",
  secondary: "bg-secondary text-on-secondary shadow-sm",
  gradient: "bg-secondary text-on-secondary shadow-sm ring-2 ring-secondary/20",
  error: "bg-error-container text-on-error-container border border-error",
};

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  className?: string;
};

export default function Avatar({ initials, size = "md", variant = "default", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold shrink-0",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {initials}
    </div>
  );
}
