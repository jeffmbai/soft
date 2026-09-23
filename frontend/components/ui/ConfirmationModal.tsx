"use client";

import { useEffect, type ReactNode } from "react";
import Button from "./Button";
import Icon from "./Icon";
import { cn } from "@/lib/cn";

export type ConfirmationVariant = "default" | "danger" | "success";

type ConfirmationModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  icon?: string;
  loading?: boolean;
  children?: ReactNode;
};

const variantStyles: Record<
  ConfirmationVariant,
  { iconBg: string; iconColor: string; confirmVariant: "primary" | "secondary" | "danger" }
> = {
  default: {
    iconBg: "bg-secondary/15",
    iconColor: "text-secondary",
    confirmVariant: "primary",
  },
  success: {
    iconBg: "bg-secondary/15",
    iconColor: "text-secondary",
    confirmVariant: "secondary",
  },
  danger: {
    iconBg: "bg-error/10",
    iconColor: "text-error",
    confirmVariant: "danger",
  },
};

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  icon = "help",
  loading = false,
  children,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-primary/30 backdrop-blur-[3px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="w-full sm:max-w-md flex flex-col bg-surface-container-lowest border border-outline-variant sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-5 sm:p-6">
          <div className="flex gap-4">
            <div
              className={cn(
                "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
                styles.iconBg,
              )}
            >
              <Icon name={icon} size={22} className={styles.iconColor} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="confirmation-modal-title"
                className="font-headline-md text-headline-md font-bold text-primary leading-tight"
              >
                {title}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">{description}</p>
            </div>
          </div>

          {children && (
            <div className="mt-4 rounded-xl border border-outline-variant/70 bg-surface-container-low p-3">
              {children}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 sm:px-6 py-4 border-t border-outline-variant bg-surface-container-low/80">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={styles.confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
