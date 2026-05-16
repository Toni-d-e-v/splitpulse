"use client";

import { useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Glass bottom sheet. Tap backdrop or Esc to close.
 * Drag-to-dismiss deferred — non-interactive handle is purely visual affordance.
 */
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-[61] max-h-[85vh] sheet-enter glass-panel-heavy rounded-t-[28px] rounded-b-none border-b-0 overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-gradient-to-b from-[rgba(10,10,30,0.9)] to-transparent">
          <span aria-hidden className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="px-5 pb-8">{children}</div>
      </div>
    </>
  );
}
