"use client";

import { useEffect, useRef, useState } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const CLOSE_THRESHOLD_PX = 110;

/**
 * Glass bottom sheet. Tap backdrop or Esc to close. Drag down on the
 * handle / sheet top to dismiss — touch starts that begin while the
 * inner content is scrolled away from the top don't pull the sheet,
 * so vertical scroll inside still works normally.
 */
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; lastY: number; active: boolean }>({
    startY: 0,
    lastY: 0,
    active: false,
  });
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  if (!open) return null;

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const target = event.target as HTMLElement;
    // If the touch starts inside a scrolled-down area, let normal scroll handle it.
    const scroller = scrollRef.current;
    const startedFromHandle = target.closest("[data-sheet-handle]") !== null;
    if (!startedFromHandle && scroller && scroller.scrollTop > 0) {
      dragRef.current.active = false;
      return;
    }
    const touch = event.touches[0];
    dragRef.current = { startY: touch.clientY, lastY: touch.clientY, active: true };
  };

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current.active) return;
    const touch = event.touches[0];
    dragRef.current.lastY = touch.clientY;
    const delta = touch.clientY - dragRef.current.startY;
    if (delta <= 0) {
      setDragOffset(0);
      return;
    }
    setDragOffset(delta);
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    if (!dragRef.current.active) return;
    const delta = dragRef.current.lastY - dragRef.current.startY;
    dragRef.current.active = false;
    if (delta > CLOSE_THRESHOLD_PX) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  const fadeFactor = Math.min(1, Math.max(0, 1 - dragOffset / 320));

  return (
    <>
      <button
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition"
        style={{ opacity: 0.4 + 0.6 * fadeFactor }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragRef.current.active
            ? "none"
            : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
          touchAction: "pan-y",
        }}
        className="fixed bottom-0 left-0 right-0 z-[61] max-h-[85vh] sheet-enter glass-panel-heavy rounded-t-[28px] rounded-b-none border-b-0 overflow-hidden"
      >
        <div
          data-sheet-handle
          className="flex cursor-grab justify-center pt-3 pb-2 bg-gradient-to-b from-[rgba(10,10,30,0.9)] to-transparent active:cursor-grabbing"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div
          ref={scrollRef}
          className="max-h-[calc(85vh-28px)] overflow-y-auto overscroll-contain px-5 pb-8"
        >
          {children}
        </div>
      </div>
    </>
  );
}
