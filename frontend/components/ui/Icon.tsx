import { cn } from "@/lib/cn";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
};

export default function Icon({ name, className, filled, size = 24 }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined leading-none", filled && "filled", className)}
      style={{ fontSize: size }}
      aria-hidden
    >
      {name}
    </span>
  );
}
