"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type UserMenuProps = {
  name: string;
  role: string;
  onLogout?: () => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function UserMenu({ name, role, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full transition-all duration-150",
          open ? "bg-surface-container-high" : "hover:bg-surface-container-low",
        )}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-on-secondary-container text-on-secondary flex items-center justify-center text-[11px] font-bold shadow-sm ring-2 ring-surface-container-lowest">
          {initials(name)}
        </div>
        <div className="hidden lg:flex flex-col items-start leading-none">
          <span className="font-label-md text-label-md text-primary font-semibold">{name}</span>
          <span className="font-data-mono text-data-mono text-[10px] text-outline capitalize mt-0.5">
            {role}
          </span>
        </div>
        <Icon
          name="expand_more"
          size={18}
          className={cn("text-outline hidden lg:block transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
          <div className="px-3 py-2 border-b border-outline-variant mb-1">
            <p className="font-label-md text-label-md font-semibold text-primary">{name}</p>
            <p className="font-data-mono text-data-mono text-[10px] text-outline capitalize">{role}</p>
          </div>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
          >
            <Icon name="person" size={18} />
            Profile
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
          >
            <Icon name="settings" size={18} />
            Settings
          </button>
          {onLogout && (
            <>
              <div className="my-1 border-t border-outline-variant" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left font-label-md text-label-md text-error hover:bg-error-container/30 transition-colors"
              >
                <Icon name="logout" size={18} />
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
