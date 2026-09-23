"use client";

import { Toaster as SonnerToaster } from "sonner";

export default function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "font-body-sm border border-outline-variant/60 shadow-lg",
          title: "font-semibold text-primary",
          description: "text-on-surface-variant",
        },
      }}
    />
  );
}
