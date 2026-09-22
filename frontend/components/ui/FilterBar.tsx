import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export type FilterSelect = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

type FilterBarProps = {
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterSelect[];
  onClear?: () => void;
  className?: string;
};

export default function FilterBar({
  searchPlaceholder = "Search…",
  search = "",
  onSearchChange,
  filters = [],
  onClear,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "bg-surface-container-low p-space-sm rounded-xl border border-outline-variant flex flex-wrap items-center gap-space-sm",
        className,
      )}
    >
      <div className="relative flex-1 min-w-[240px]">
        <Icon
          name="search"
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 bg-surface-container-lowest border-0 rounded-full text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
        />
      </div>
      {filters.map((filter) => (
        <select
          key={filter.id}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          aria-label={filter.label}
          className="bg-surface-container-lowest border border-outline-variant rounded-full py-2 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
        >
          {filter.options.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto px-2.5 py-1.5 text-outline hover:text-primary font-label-md text-label-md"
        >
          Clear
        </button>
      )}
    </div>
  );
}
