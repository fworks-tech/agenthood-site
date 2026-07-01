"use client";

import { useCallback, useRef, useEffect, useState } from "react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  children: React.ReactNode;
}

export default function MobileDrawer({ open, onClose, onOpen, children }: MobileDrawerProps) {
  const [translateX, setTranslateX] = useState(open ? 0 : -320);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTranslateX(open ? 0 : -320);
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientX - startX.current;
    const newTranslate = Math.max(-320, Math.min(0, delta - 320));
    setTranslateX(newTranslate);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (translateX > -160) {
      onOpen();
    } else {
      onClose();
    }
  }, [isDragging, translateX, onOpen, onClose]);

  const handleEdgeSwipe = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX < 20) {
      startX.current = touch.clientX;
      setIsDragging(true);
    }
  }, []);

  return (
    <>
      <div
        className="fixed top-0 left-0 bottom-0 w-5 z-30 md:hidden"
        onTouchStart={handleEdgeSwipe}
      />
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 md:hidden transition-transform ${
          isDragging ? "" : "transition-transform duration-300"
        }`}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full overflow-hidden border-r border-zinc-800 bg-zinc-950">
          {children}
        </div>
      </div>
    </>
  );
}
