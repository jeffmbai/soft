import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-inverse-surface shadow-sm",
  secondary: "bg-secondary text-on-secondary hover:bg-on-secondary-container shadow-sm",
  outline: "border border-outline-variant bg-surface-container-lowest text-primary hover:bg-surface-container-low",
  ghost: "text-on-surface-variant hover:text-primary hover:bg-surface-container-low",
  danger: "bg-error text-on-error hover:opacity-90 shadow-sm",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-label-md rounded-xl gap-1",
  md: "px-3.5 py-2 text-label-md rounded-xl gap-1.5",
  lg: "px-4 py-2.5 text-body-sm rounded-2xl gap-2",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  fullWidth?: boolean;
};

export default function Button({
  variant = "outline",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center font-label-md font-semibold transition-all active:scale-[0.98] disabled:opacity-50",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </button>
  );
}
