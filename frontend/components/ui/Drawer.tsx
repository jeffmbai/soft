"use client";

import { useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
};

const widths = { sm: "sm:w-[360px]", md: "sm:w-[400px]", lg: "sm:w-[480px]" };

export default function Drawer({
  open,
  onClose,
  header,
  footer,
  children,
  width = "md",
}: DrawerProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 bg-primary/20 backdrop-blur-[2px] z-40"
      />
      <aside
        className={cn(
          "fixed top-[60px] right-0 bottom-0 z-50 w-full flex flex-col",
          "bg-surface-container-lowest border-l border-outline-variant shadow-2xl",
          widths[width],
        )}
      >
        {header}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="shrink-0 p-4 border-t border-outline-variant bg-surface-container-lowest">{footer}</div>
        )}
      </aside>
    </>
  );
}

export function DrawerCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="p-2 rounded-full text-on-primary-container hover:text-inverse-on-surface hover:bg-white/10 transition-colors"
    >
      <Icon name="close" size={20} />
    </button>
  );
}
