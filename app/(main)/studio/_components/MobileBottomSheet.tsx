"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Drawer } from "@mantine/core";

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function MobileBottomSheet({ open, onClose, children }: MobileBottomSheetProps) {
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    setTranslateY(Math.max(0, e.touches[0].clientY - startY.current));
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (translateY > 100) {
      onClose();
    } else {
      setTranslateY(0);
    }
  }, [isDragging, translateY, onClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setTranslateY(0);
  }, [open]);

  return (
    <Drawer
      opened={open}
      onClose={onClose}
      position="bottom"
      size="85vh"
      withCloseButton={false}
      padding={0}
      styles={{
        content: {
          borderRadius: "16px 16px 0 0",
          border: "1px solid var(--mantine-color-zinc-8)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        },
        body: { padding: 0, overflow: "hidden" },
      }}
      transitionProps={{ transition: "slide-up", duration: 300 }}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 40px)" }}>
          {children}
        </div>
      </div>
    </Drawer>
  );
}
